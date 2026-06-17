# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tool homelab infra repo. Cluster name: `hydra`. Domain: `thetillhoff.de`. Tools:

- **`pulumi/`** — IaC: Hetzner Cloud VMs, Cloudflare DNS, Talos bootstrap, Cilium install, FluxCD bootstrap
- **`kubernetes/`** — GitOps manifests synced by FluxCD (Helm releases, Kustomizations, app deployments)
- **`ansible/`** — Config management for bare-metal hosts (e.g. `blackhole` storage server)
- **`packer/`** — Builds Talos Linux images for Hetzner Cloud (amd64/arm64)

## Commands

### Pulumi (run from `pulumi/`)

```sh
pulumi preview          # dry-run
pulumi up               # deploy
npm run format          # prettier
```

### Taskfile (run from repo root)

```sh
task configure-env | source /dev/stdin   # set TALOSCONFIG, KUBECONFIG, SOPS_AGE_KEY_FILE env vars
task configure-files                     # write talosconfig + kubeconfig files to pulumi/
task deploy                              # pulumi up
task build ARCH=amd64                    # build packer image (token auto-sourced from pulumi config)
task reconcile                           # force-reconcile all flux kustomizations
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
        └── infrastructure-resources  (kubernetes/infrastructure/resources/)
  └── apps                         (kubernetes/apps/hydra/)
```

Cluster entrypoints are in `kubernetes/clusters/hydra/`. All Kustomizations use SOPS decryption via the `sops-age` secret.

### Kubernetes manifest layout

```text
kubernetes/
  clusters/hydra/          # FluxCD Kustomization entrypoints
  infrastructure/
    controllers/           # HelmReleases: cert-manager, longhorn, tailscale operator, kubelet-csr-approver
    resources/             # Cluster resources: cert-manager issuers, gateways, firewall policies, monitoring, discord alerts
  apps/
    hydra/                 # Per-app dirs: link-shortener, vaultwarden, umami, thetillhoff-de, tailscale
```

Each app dir typically contains: namespace, deployment/statefulset, service, HTTPRoutes (http+https), imagePolicy + imageRepository + imageUpdateAutomation (for FluxCD image automation), and optionally `*.secret.yaml` (SOPS-encrypted).

### Networking / Ingress

Cilium is both the CNI and the Gateway API implementation (no separate ingress controller). Apps expose themselves via `HTTPRoute` resources referencing Gateways in `kubernetes/infrastructure/resources/gateways/`. Network policies use `CiliumClusterwideNetworkPolicy` in `kubernetes/infrastructure/resources/firewall/`.

### Storage

Longhorn for persistent volumes in Kubernetes. Bare-metal ZFS on `blackhole` (managed via Ansible).

### Versions

Version constants (kubernetes, cilium, gatewayApiCrds, fluxOperator, flux) are centralized in `pulumi/index.ts`.
