# AGENTS.md

Guidance for coding agents that work in this repository.

## Overview

Multi-tool homelab infra repo. Cluster name: `hydra`. Domain: `thetillhoff.de`. Tools:

- **`pulumi/`** — IaC: Hetzner Cloud VMs, Cloudflare DNS, Talos bootstrap, Cilium install, FluxCD bootstrap
- **`kubernetes/`** — GitOps manifests synced by FluxCD (Helm releases, Kustomizations, app deployments)
- **`ansible/`** — Config management for bare-metal hosts (e.g. `blackhole` storage server)
- **`packer/`** — Builds Talos Linux images for Hetzner Cloud (amd64/arm64)

Standalone Raspberry Pis (not in the cluster) have their own root-level setup docs: `magic-mirror-setup.md`, `homeassistant-setup.md` (Home Assistant OS + Caddy2 reverse proxy).

## Commands

### Pulumi (run from `pulumi/`)

State lives in **Pulumi Cloud** (`https://api.pulumi.com`, stack `infra`), no AWS credentials needed. The machine's
current `pulumi login` is global per user and may point at another project's S3 backend. So run Pulumi through the
tasks below: they set `PULUMI_BACKEND_URL` and `--stack` on the command and leave the login alone. A bare `pulumi`
command works only if the current login is Pulumi Cloud.

```sh
task preview                    # dry-run (npm install first)
task deploy                     # npm install, then pulumi up
task pulumi -- stack output     # any other pulumi command on the stack
npm run format                  # prettier — see caution below
```

> **`npm run format` = `prettier --write .`** — reformats the *whole tree*, including `cilium-values.yaml`
> and the `configPatches/*.yaml` files. Reindenting a comment in a nodegroup patch changes the string fed to
> `talos.machine.ConfigurationApply` → a spurious `~ update` re-apply against the **live** controlplanes on the
> next `pulumi up`. Format scoped files only, or revert unrelated reformats (`git checkout -- <file>`) before deploying.

### Taskfile (run from repo root)

```sh
task configure-env | source /dev/stdin   # set TALOSCONFIG, KUBECONFIG, SOPS_AGE_KEY_FILE env vars
task configure-files                     # write talosconfig + kubeconfig files to pulumi/
task preview                             # pulumi preview --diff
task deploy                              # pulumi up
task pulumi -- <args>                    # pulumi <args> on the Pulumi Cloud stack
task build ARCH=amd64                    # build packer image (token auto-sourced from pulumi config)
task reconcile                           # force-reconcile all flux kustomizations (--with-source)
task delete-nodes -- <node1> <node2>    # drain + remove nodes before server deletion
task upgrade-k8s -- 1.33.0             # upgrade k8s version via talosctl
```

### Ansible (run from `ansible/`)

```sh
make run          # apply playbook (blackhole.yaml by default)
make check        # dry-run
make lint         # syntax check + ansible-lint
make docker-build # build container image
make docker-run   # run playbook in container (mounts ~/.ssh)
```

### Secrets (SOPS + AGE)

```sh
sops edit <file>              # edit encrypted file in-place
sops encrypt -i <file>        # encrypt in-place
sops decrypt -i <file>        # decrypt in-place
export SOPS_AGE_KEY_FILE=$(pwd)/age.key  # or use task configure-env
```

`sops encrypt` encrypts the `data`/`stringData` values of a YAML Secret, and a non-YAML file whole (`.sops.yaml`).

### CI

Every push runs `.github/workflows/validate-kubernetes.yaml`: strict `kubeconform` on each built Flux Kustomization, and `flux-local test`, which also renders each HelmRelease. To run it locally, use the flux-local image of the workflow with `docker run --rm -e HOME=/tmp -v "$PWD:/repo:z" -w /repo <image> test --enable-helm --path kubernetes/clusters/hydra` (helm needs a writable HOME).

A push that changes `pulumi/` also runs `validate-pulumi.yaml`: a type check with `tsc --noEmit`, with no Pulumi token, so it cannot read the stack state. Run `task preview` locally for a real preview.

Renovate automerges only after these checks pass, and never a version in `pulumi/index.ts` (`UPGRADE-K8S-AND-OTHERS.md`).

## Architecture

### Pulumi → FluxCD handoff

Pulumi provisions Hetzner Cloud nodes, configures Talos, bootstraps the cluster, then installs Cilium + FluxCD. After that, FluxCD takes over: it watches this repo and applies everything under `kubernetes/`.

Pulumi components:

- `HcloudTalosNodegroup` — creates HCloud servers + Cloudflare DNS A/AAAA records per node, applies Talos machine config
- `HcloudTalosCluster` — bootstraps Talos, generates kubeconfig, installs Gateway API CRDs + Cilium + Flux Operator + FluxInstance

Pulumi secrets required in stack config: `flux.git-auth` (deploy token), `flux.sops-age` (private AGE key for FluxCD to decrypt secrets at runtime).

### FluxCD sync order (Kustomizations)

```text
flux-system
  ├── controller-*   (one per kubernetes/infrastructure/controllers/<controller>/)
  ├── resource-*     (one per kubernetes/infrastructure/resources/<component>/)
  └── app-*          (one per kubernetes/apps/hydra/<app>/)
```

Kustomizations are **per controller, per component and per app** — a broken one can't block unrelated deploys. Names match the entrypoint filenames in `kubernetes/clusters/hydra/`, e.g. `controller-longhorn`, `app-trading`. A `dependsOn` names only the Kustomization that an apply needs (a CRD or a StorageClass): `resource-cert-manager` and `resource-private-endpoints` on `controller-cert-manager`, `resource-monitoring` and each app with a PVC on `controller-longhorn`. All use SOPS decryption via the `sops-age` secret.

### Kubernetes manifest layout

```text
kubernetes/
  clusters/hydra/          # FluxCD Kustomization entrypoints
  infrastructure/
    controllers/           # one dir per controller (HelmRelease)
    resources/             # one dir per cluster component
  apps/
    hydra/                 # one dir per app
```

`kubernetes/apps/hydra/trading/` is the **source of truth for the trading app on hydra** (Flux `app-trading`). The `~/code/trading` repo's `k8s/`/`services/` manifests are **local-dev (kind) only** and intentionally diverge — never edit them expecting a hydra change.

Notes about one app or one component are in a `README.md` next to it (list: `find kubernetes pulumi -name README.md`).

Each app dir typically contains: namespace, a `default` ServiceAccount without API token (`serviceAccount-default.yaml`), deployment/statefulset, service, HTTPRoutes (http+https), imagePolicy + imageRepository + imageUpdateAutomation (for FluxCD image automation), and optionally `*.secret.yaml` (SOPS-encrypted).

### Networking / Ingress

Cilium is both the CNI and the Gateway API implementation (no separate ingress controller). Apps expose themselves via `HTTPRoute` resources referencing Gateways in `kubernetes/infrastructure/resources/gateways/`. Network policies use `CiliumClusterwideNetworkPolicy` in `kubernetes/infrastructure/resources/firewall/`.

Note: the `CiliumClusterwideNetworkPolicy` in `firewall/` uses `nodeSelector: {}` — it is a **node/host** firewall, not a pod-to-pod policy. A namespace with a `default-deny-ingress` policy blocks ingress by default (list: `kubectl get networkpolicy -A | grep default-deny-ingress`); other namespaces are open.

The Cilium Gateway reaches a backend as the entity `ingress`, which a `NetworkPolicy` cannot select. Allow it with a `CiliumNetworkPolicy` and `fromEntities: [ingress]` (example: `apps/hydra/vaultwarden/ciliumNetworkPolicy-vaultwarden-from-gateway.yaml`). To test a block, run `curl --max-time 5` from a pod of another namespace that has curl (a caddy pod in `private-endpoints`): a blocked call times out with exit 28.

The node firewall is live: `kubernetes/infrastructure/resources/firewall/README.md` lists the open ports and how to change the policy safely. Which layer encrypts which traffic: "Network encryption" in `pulumi/README.md`.

### Workloads with 2 or more replicas

The ValidatingAdmissionPolicy in `kubernetes/infrastructure/resources/admission-policies/` rejects such a Deployment or StatefulSet in an app namespace without `topologySpreadConstraints` or `podAntiAffinity`. Add a `PodDisruptionBudget` next to it by hand (example: `apps/hydra/thetillhoff-de/`): the policy cannot check that.

### Private endpoints (tailnet-only)

Admin UIs (grafana, longhorn, hubble) and the app UIs that must not be public (trading, manga, analytics) are at `<name>.internal.thetillhoff.de`. Only the Tailscale tailnet reaches them. Setup, Caddy proxies and the Tailscale console steps: `kubernetes/infrastructure/resources/private-endpoints/README.md`.

The public `analytics.thetillhoff.de` route (`apps/hydra/umami/httpRoute-https.yaml`) serves only `/script.js` and `/api/send`, which the tracker script of the websites needs.

### Storage

Longhorn for persistent volumes in Kubernetes. Its StorageClass is the default and uses `reclaimPolicy: Retain`: a deleted PVC leaves an orphan PV and a Longhorn volume (cleanup: `kubernetes` skill, `references/longhorn.md`). Backups and the restore runbook after a cluster rebuild: `kubernetes/infrastructure/controllers/longhorn/README.md`. Bare-metal ZFS on `blackhole` (managed via Ansible).

### Versions

Version constants (kubernetes, cilium, gatewayApiCrds, fluxOperator) are centralized in `pulumi/index.ts`. Flux itself follows `2.x` (`pulumi/hcloud-talos-cluster-component/fluxInstance.yaml`): the flux-operator updates it.
Talos version lives in `packer/common.pkrvars.hcl` + the nodegroup name (`hcloud-talos-vX-Y-Z-controlplane`).

**Only ever upgrade to GA versions** — no alpha/beta/rc. Check each project's releases page for the latest
GA before bumping; a "next minor" that isn't GA yet (k8s/Talos often lag each other) is out of scope until released.

## Known Gotchas

### kubectl/flux context

Default kubeconfig context may be a local kind cluster, not hydra. Always run `eval "$(task configure-env)"` before any kubectl/flux commands.

### Memory limits

3 control-plane nodes (cx43, 8 vCPU / 16 GB), no workers. The `trading` namespace has a ResourceQuota. A namespace with a `LimitRange` (`limitRange-default-memory.yaml`; list: `find kubernetes -name limitRange-default-memory.yaml`) gives a container without limits a 256Mi memory limit. A container that peaks above about 150Mi needs its own `resources`.

Recover an unresponsive Talos node with a Hetzner hard reset (console or `hcloud server reset`). If `apid` is dead, `talosctl reboot` cannot reach it.

### Cilium Gateway API: the Gateway address is one node only

Cilium runs in host-network mode (`pulumi/cilium-values.yaml`): the Envoy daemonset binds to the IPs of all nodes, and DNS points to all of them. The Gateway status shows only one node IP. Check health with the Envoy pods and a real HTTP response, not the gateway status.
