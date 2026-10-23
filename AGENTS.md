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

Secret files matching `*secret*` or containing `data`/`stringData` keys are auto-encrypted per `.sops.yaml`.

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
  └── infrastructure-controllers   (kubernetes/infrastructure/controllers/)
        └── resource-*             (one per kubernetes/infrastructure/resources/<component>/)
  └── app-*                        (one per kubernetes/apps/hydra/<app>/)
```

Kustomizations are **per component and per app**, not two big ones — a broken app or component can't
block unrelated deploys. Names match the entrypoint filenames in `kubernetes/clusters/hydra/`, e.g.
`resource-private-endpoints`, `app-trading`. `flux get kustomizations` lists the live set; there is no
`infrastructure-resources` or `apps` Kustomization. All use SOPS decryption via the `sops-age` secret.

### Kubernetes manifest layout

```text
kubernetes/
  clusters/hydra/          # FluxCD Kustomization entrypoints
  infrastructure/
    controllers/           # HelmReleases: cert-manager, external-dns, longhorn, tailscale operator (kubelet-csr-approver exists but is disabled in `controllers/kustomization.yaml`)
    resources/             # Cluster resources: cert-manager issuers, gateways, firewall policies, monitoring, flux alerts, private-endpoints
  apps/
    hydra/                 # Per-app dirs: link-shortener, vaultwarden, umami, thetillhoff-de, tailscale, trading, federated-cloud-platform, manga-scraper
```

`kubernetes/apps/hydra/trading/` is the **source of truth for the trading app on hydra** (Flux `app-trading`). The `~/code/trading` repo's `k8s/`/`services/` manifests are **local-dev (kind) only** and intentionally diverge — never edit them expecting a hydra change.

Notes about one app or one component are in a `README.md` next to it (for example `manga-scraper`, `thetillhoff-de`, `private-endpoints`, `monitoring`, `firewall`, `cert-manager`, `pulumi`).

Each app dir typically contains: namespace, deployment/statefulset, service, HTTPRoutes (http+https), imagePolicy + imageRepository + imageUpdateAutomation (for FluxCD image automation), and optionally `*.secret.yaml` (SOPS-encrypted).

### Networking / Ingress

Cilium is both the CNI and the Gateway API implementation (no separate ingress controller). Apps expose themselves via `HTTPRoute` resources referencing Gateways in `kubernetes/infrastructure/resources/gateways/`. Network policies use `CiliumClusterwideNetworkPolicy` in `kubernetes/infrastructure/resources/firewall/`.

Note: the `CiliumClusterwideNetworkPolicy` in `firewall/` uses `nodeSelector: {}` — it is a **node/host** firewall, not a pod-to-pod policy. There is no pod-level default-deny, so cross-namespace pod traffic is unrestricted.

The host policy is inert today: see `kubernetes/infrastructure/resources/firewall/README.md` before you turn it on.

### Private endpoints (tailnet-only)

Admin UIs (grafana, longhorn, hubble) and the app UIs that must not be public (trading, manga, analytics) are at `<name>.internal.thetillhoff.de`. Only the Tailscale tailnet reaches them. Setup, Caddy proxies and the Tailscale console steps: `kubernetes/infrastructure/resources/private-endpoints/README.md`.

The public `analytics.thetillhoff.de` route (`apps/hydra/umami/httpRoute-https.yaml`) serves only `/script.js` and `/api/send`, which the tracker script of the websites needs.

### Storage

Longhorn for persistent volumes in Kubernetes. Its StorageClass is the default and uses `reclaimPolicy: Retain`: a deleted PVC leaves an orphan PV and a Longhorn volume (cleanup: `kubernetes` skill, `references/longhorn.md`). Bare-metal ZFS on `blackhole` (managed via Ansible).

### Versions

Version constants (kubernetes, cilium, gatewayApiCrds, fluxOperator, flux) are centralized in `pulumi/index.ts`.
Talos version lives in `packer/common.pkrvars.hcl` + the nodegroup name (`hcloud-talos-vX-Y-Z-controlplane`).

**Only ever upgrade to GA versions** — no alpha/beta/rc. Check each project's releases page for the latest
GA before bumping; a "next minor" that isn't GA yet (k8s/Talos often lag each other) is out of scope until released.

## Known Gotchas

### kubectl/flux context

Default kubeconfig context may be a local kind cluster, not hydra. Always run `eval "$(task configure-env)"` before any kubectl/flux commands.

### Memory pressure

3 control-plane nodes (cx43, 8 vCPU / 16 GB), no workers. The baseline is heavy: prometheus about 2.75GB, 3x kube-apiserver up to 3.9GB, Longhorn, Cilium. A large batch burst can still hit the kernel OOM-killer and take the nodes down. The `trading` namespace has a ResourceQuota.

Recover an unresponsive Talos node with a Hetzner hard reset (console or `hcloud server reset`). If `apid` is dead, `talosctl reboot` cannot reach it.

### Cilium Gateway API: PROGRAMMED False is normal

Gateways always show `PROGRAMMED: False / AddressNotAssigned`. Cilium runs in host-network mode (`pulumi/cilium-values.yaml`): the Envoy daemonset binds to the node IPs, and no LoadBalancer IP is written to `.status.addresses`. Check health with the Envoy pods and a real HTTP response, not the gateway status.
