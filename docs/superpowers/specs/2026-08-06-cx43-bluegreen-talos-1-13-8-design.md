# cx43 blue/green + Talos v1.13.8 — design & execution plan

Date: 2026-08-06

## Goal

Blue/green-replace the 3× cx33 controlplane nodegroup with 3× **cx43** (8 vCPU / 16 GB,
2× the RAM) to resolve the standing memory-oversubscription / OOM problem (CLAUDE.md),
picking up the latest **GA** Talos patch on the new image. **No data loss.**

## Version scope (GA-only)

Requested minor bumps don't exist as GA yet, so they're out of scope:

- k8s 1.37 → GA 2026-08-26 (not released). Stays **v1.36.2**.
- Talos 1.14 → beta only, still targets k8s 1.36. Talos moves **v1.13.4 → v1.13.8** (patch).
- cilium 1.20.0 / gatewayApiCrds v1.6.1 / fluxOperator 0.57.0 / flux v2.9.3 — all already latest. **No change.**

Principle going forward: only ever upgrade to GA versions.

## Concrete parameter set

| Item | From | To |
| --- | --- | --- |
| `packer/common.pkrvars.hcl` `talos_version` | v1.13.4 | **v1.13.8** |
| packer `image_id` (extensions schematic) | `613e…961245` | **unchanged** (schematic is version-independent) |
| Nodegroup name (`pulumi/index.ts`) | `hcloud-talos-v1-13-4-controlplane` | `hcloud-talos-v1-13-8-controlplane` |
| `hcloudServerType` | cx33 | **cx43** |
| `hcloudImageId` (HCloud snapshot) | 398555717 | **new** — build output of step 2 |
| nodeCount / machineType / hcloudLocation | 3 / controlplane / nbg1 | unchanged |
| `versions.kubernetes` | v1.36.2 | **unchanged** |
| configPatch file | `talos-v1-13-4-controlplane-patch.yaml` | copy → `talos-v1-13-8-controlplane-patch.yaml` (identical content) |

## Deltas from a normal Talos upgrade

- **No `@pulumiverse/talos` provider bump** → the k8s cascade (Cilium/Flux/CRD delete+recreate)
  does NOT fire. Step-3 preview must be additions only; if it shows deletes, stop.
- **No `task upgrade-k8s`** → k8s stays 1.36.2, new nodes bootstrap at 1.36.2. No version skew.
- Only amd64 image built (nodes are amd64; arm64 vars untouched).

## Data-loss safety (the critical part)

State that must survive:

- **etcd** (cluster state): blue/green keeps quorum. 3→6 controlplanes (quorum 4) → back to 3
  (quorum 2). `talosctl reset` in `delete-nodes` removes each old member cleanly. Safe by design.
- **Longhorn PVs** (postgres for federated-cloud-platform, vaultwarden, umami, …): the real risk.
  2 replicas per volume currently on the 3 old nodes. Deleting all old nodes without first
  moving replicas onto the cx43 nodes = data loss.

Guarantees in place: `nodeDrainPolicy: block-for-eviction` (drain blocks until replicas rebuilt
elsewhere), `replicaAutoBalance: best-effort`, `reclaimPolicy: Retain`, daily S3 backups to
Backblaze (`s3://hydra-k8s-backup@backblaze/`).

Rules enforced in the sequence below:

1. Confirm a recent successful Backblaze backup exists before starting (fallback of last resort).
2. New cx43 nodes must be Longhorn-registered with schedulable disks **before** any old node is
   drained. Verify: `kubectl -n longhorn get nodes.longhorn.io`.
3. **Pre-migrate** replicas: disable Longhorn scheduling on the 3 old nodes, let auto-balance +
   manual replica rebuild move every replica onto cx43 nodes, and wait until every volume shows
   2 `healthy` replicas all on cx43 nodes. This decouples data migration from node deletion.
4. Delete old nodes **one at a time**, re-verifying all volumes `healthy` between each. Do NOT
   pass all three to `delete-nodes` at once. `block-for-eviction` is the backstop if a replica
   was missed.

Volume health check:

```sh
kubectl get volumes.longhorn.io -n longhorn \
  -o custom-columns='NAME:.metadata.name,REPLICAS:.spec.numberOfReplicas,ROBUSTNESS:.status.robustness'
```

All must show `healthy` at every gate.

## Sequence

Run `eval "$(task configure-env)"` first (default kubeconfig context may be a kind cluster).

0. **Pre-flight**
   - cx43 available in nbg1 (Hetzner console).
   - All Longhorn volumes `healthy` (command above).
   - Recent Backblaze backup present.
1. **Build image** — `packer/common.pkrvars.hcl`: `talos_version` → `v1.13.8` (leave `image_id`).
   `task build ARCH=amd64`. **Record the new HCloud snapshot ID** from output.
2. **Add cx43 nodegroup**
   - Copy `talos-v1-13-4-controlplane-patch.yaml` → `talos-v1-13-8-controlplane-patch.yaml`.
   - In `pulumi/index.ts`: add second nodegroup `hcloud-talos-v1-13-8-controlplane`
     (cx43, new snapshot ID, new patchfile). Keep the old nodegroup in place.
   - `task deploy`. **Preview must be additions only** (3 servers + DNS). Abort if any delete.
   - Verify: `kubectl get nodes -owide` → 6 Ready, new ones on v1.36.2.
   - Verify: `kubectl -n longhorn get nodes.longhorn.io` → 3 new nodes present, schedulable, disk Ready.
3. **Pre-migrate Longhorn replicas** (data-safety gate)
   - Disable scheduling on the 3 old Longhorn nodes (UI or patch `spec.allowScheduling: false`).
   - Trigger/allow replica rebuild onto cx43 nodes; wait until every volume = 2 `healthy` replicas,
     all on cx43 nodes.
4. **Flip primary**
   - `pulumi/index.ts`: `primaryControlplaneNodegroupName` → `hcloud-talos-v1-13-8-controlplane`.
   - `task deploy` → `task configure-files` → `eval "$(task configure-env)"`.
5. **Remove old nodes** (one at a time)
   - For each old cx33 node: `task delete-nodes -- <one-nodename>`; wait; re-verify all volumes
     `healthy` before the next.
6. **Remove old nodegroup**
   - Delete `hcloud-talos-v1-13-4-controlplane` from `pulumi/index.ts`.
   - `task deploy` → Pulumi deletes old servers + DNS records.
7. **Cleanup**
   - Delete `talos-v1-13-4-controlplane-patch.yaml`.
   - Update docs: CLAUDE.md memory note (capacity fix done → cx43), add GA-only principle.
   - Commit + push. Check the CI pipeline.

## Rollback

- Before step 5 (old nodes still intact): revert `index.ts` primary + remove new nodegroup,
  `task deploy`. Old cx33 cluster is untouched.
- After step 5: recovery is via Longhorn (replicas already on cx43) + Backblaze backups if needed.
