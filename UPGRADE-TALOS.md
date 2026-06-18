# How to upgrade talos nodegroups

## 0. Prerequisites

- Log in to Hetzner Cloud and verify new instances of the desired type are available.
- Ensure Longhorn volumes are healthy before proceeding (check again in step 4):

  ```sh
  kubectl get volumes.longhorn.io -n longhorn -o custom-columns='NAME:.metadata.name,REPLICAS:.spec.numberOfReplicas,ROBUSTNESS:.status.robustness'
  ```

  All volumes must show `healthy` before draining any node.

If in-place upgrade is preferred over blue/green:

```sh
# Update the version tag. Config hash should stay the same.
# Run for each node:
talosctl upgrade -n <node-ip> --preserve --image factory.talos.dev/hcloud-installer/613e1592b2da41ae5e265e8789429f22e121aab91cb4deb6bc3c0b6262961245:v1.12.6
```

Monitor with `talosctl dmesg -f` or `talosctl upgrade --wait --debug`.

Check available Talos versions: <https://github.com/siderolabs/talos/releases/latest>

Check compatibility with Kubernetes versions: <https://docs.siderolabs.com/talos/v1.11/getting-started/support-matrix>

## 1. Build new Talos image via packer

- Update `talos_version` and `image_id` in `packer/common.pkrvars.hcl` (shared by all arch-specific files).
- Build new images: `task build ARCH=amd64` (HCLOUD_TOKEN is auto-sourced from pulumi config).
- Note the HCloud snapshot ID from the build output.

## 2. Create a new nodegroup

- Add a new nodegroup in `pulumi/index.ts` referencing the new snapshot ID.
- Create a patchfile in `pulumi/hcloud-talos-nodegroup-component/configPatches/<name>.yaml` (copy from previous nodegroup).
- Run `npm install` in `pulumi/` first if `@pulumiverse/talos` was also bumped (stale node_modules cause wrong plugin version).
- Run `task deploy`. The preview should show only additions for the new nodegroup.

  > **Note:** If `@pulumiverse/talos` was bumped, the deploy will show a cascade: `talosSecrets update → kubernetesProvider replace → 71 k8s resource deletes` (Cilium, FluxCD, Gateway CRDs). These deletes are real — there will be a ~2-5 min networking gap while Cilium restarts. FluxCD reconciles everything back within minutes. Talos nodes and etcd are unaffected. The `clusterIdentifier` in the provider config mitigates this for future bumps, but not the first one after adding it.
  >
  > **Helm repo error:** If `task deploy` fails with `unable to locate chart: no cached repo found`, run `helm repo add cilium https://helm.cilium.io/ && helm repo update`, then re-run `task deploy`.

## 3. Make the new nodegroup the primary one

- In `pulumi/index.ts`, update `primaryControlplaneNodegroupName` to the new nodegroup name.
- Run `task deploy` (even with no resource changes — needed so pulumi outputs reflect the new primary).
- Run `task configure-files` to write updated talosconfig/kubeconfig.
- Run `task configure-env | source /dev/stdin` to set env vars.

## 4. Remove old nodes from Kubernetes

- Verify Longhorn volumes are all `healthy` (see step 0).
- Verify which nodes to remove: `kubectl get nodes -owide`
- Run `task delete-nodes -- <nodename1> <nodename2> <nodename3>`

  The task cordons all nodes first (no new scheduling), then for each: drains pods gracefully, resets Talos (`--wait=false` avoids a false-positive exit code when the node goes unreachable), and removes the node from Kubernetes.

  > **If the task exits early:** `talosctl reset` may still have succeeded even if the task failed. Check `kubectl get nodes` — if the node is `NotReady`, the reset worked. Manually run `kubectl delete node <name>` and re-run `task delete-nodes` for the remaining nodes.
  >
  > **Longhorn CSI PDB deadlock:** If drain is stuck on `csi-attacher` or `csi-provisioner` with PDB violations, the Longhorn values.yaml sets `attacherReplicaCount: 2` etc. to prevent this. If it still happens (e.g. first deploy after changing from 1 to 2), temporarily scale up: `kubectl scale deployment -n longhorn csi-attacher csi-provisioner --replicas=2`.

## 5. Remove the old nodegroup

- Remove the old nodegroup from `pulumi/index.ts`.
- Run `task deploy` — Pulumi deletes the HCloud servers and DNS records. No manual deletion in Hetzner console needed.

## 6. Cleanup

- Remove the old patchfile from `pulumi/hcloud-talos-nodegroup-component/configPatches/`.
- Commit and push all changes.
- Check the pipeline for errors.
