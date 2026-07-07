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
        └── infrastructure-resources  (kubernetes/infrastructure/resources/)
  └── apps                         (kubernetes/apps/hydra/)
```

Cluster entrypoints are in `kubernetes/clusters/hydra/`. All Kustomizations use SOPS decryption via the `sops-age` secret.

### Kubernetes manifest layout

```text
kubernetes/
  clusters/hydra/          # FluxCD Kustomization entrypoints
  infrastructure/
    controllers/           # HelmReleases: cert-manager, external-dns, longhorn, tailscale operator, kubelet-csr-approver
    resources/             # Cluster resources: cert-manager issuers, gateways, firewall policies, monitoring, discord alerts, private-endpoints
  apps/
    hydra/                 # Per-app dirs: link-shortener, vaultwarden, umami, thetillhoff-de, tailscale
```

Each app dir typically contains: namespace, deployment/statefulset, service, HTTPRoutes (http+https), imagePolicy + imageRepository + imageUpdateAutomation (for FluxCD image automation), and optionally `*.secret.yaml` (SOPS-encrypted).

### Networking / Ingress

Cilium is both the CNI and the Gateway API implementation (no separate ingress controller). Apps expose themselves via `HTTPRoute` resources referencing Gateways in `kubernetes/infrastructure/resources/gateways/`. Network policies use `CiliumClusterwideNetworkPolicy` in `kubernetes/infrastructure/resources/firewall/`.

Note: the `CiliumClusterwideNetworkPolicy` in `firewall/` uses `nodeSelector: {}` — it is a **node/host** firewall, not a pod-to-pod policy. There is no pod-level default-deny, so cross-namespace pod traffic is unrestricted.

### Private endpoints (tailnet-only)

Admin UIs (grafana, longhorn, hubble) are exposed privately at `<app>.internal.thetillhoff.de` — reachable only over the Tailscale tailnet, not the public internet. Defined in `kubernetes/infrastructure/resources/private-endpoints/`.

Per app: a small **Caddy** reverse-proxy (non-root, binds `:8443`) terminates a real LetsEncrypt cert (cert-manager DNS-01, per-name `Certificate`) and proxies to the in-cluster app Service. A `Service` `type: LoadBalancer, loadBalancerClass: tailscale` makes the tailscale operator join a proxy to the tailnet and write the private `100.x` (CGNAT) IP into the Service's LB status. **external-dns** (in the `cert-manager` namespace, reusing that namespace's `cloudflare-api-token`) reads the LB IP and creates the `A` record. Security is the WireGuard mesh + tailnet ACLs — the public resolves the DNS but cannot route to `100.64.0.0/10`.

All proxies share the same caddy image automation (`imageRepository`/`imagePolicy`/`imageUpdateAutomation` in that dir). Adding an endpoint = copy a `certificate`/`configMap`/`deployment`/`service` quartet + wire into `kustomization.yaml`.

### Storage

Longhorn for persistent volumes in Kubernetes. Bare-metal ZFS on `blackhole` (managed via Ansible).

### Versions

Version constants (kubernetes, cilium, gatewayApiCrds, fluxOperator, flux) are centralized in `pulumi/index.ts`.

## Known Gotchas

### kubectl/flux context

Default kubeconfig context may be a local kind cluster, not hydra. Always run `eval "$(task configure-env)"` before any kubectl/flux commands.

### Private endpoints require out-of-band Tailscale config

The `private-endpoints` manifests are inert until the tailnet is set up (done in the Tailscale admin console, not this repo):

- The operator's OAuth client (`operator-oauth.secret.yaml`) must be allowed to create devices with the proxy tag (`tag:service`, set via Service annotation).
- Tailnet **ACLs** must grant your user access to `tag:service` devices on port `443` — otherwise the `100.x` IP resolves but connections are refused. This is the actual access control; DNS is not.

### Cilium Gateway API — PROGRAMMED: False is normal

Gateways always show `PROGRAMMED: False / AddressNotAssigned` — expected, not a bug. Cilium runs in host-network mode (`pulumi/cilium-values.yaml`): Envoy daemonset binds directly to node IPs; no LoadBalancer IP is ever written to `.status.addresses`. Verify health via Envoy daemonset pods + actual HTTP response, not gateway status.

### cert-manager Gateway TLS mechanics

TLS is annotation-driven: `cert-manager.io/cluster-issuer` on a Gateway causes cert-manager to auto-create Certificates per listener. Listeners sharing the same `certificateRefs[0].name` → one multi-SAN cert; unique names → separate certs (one per app).

DNS-01 required for any non-public gateway (HTTP-01 requires ACME server to reach the cluster). Cloudflare DNS-01 token: `Zone › DNS › Edit` scoped to `thetillhoff.de` only, stored as Secret `cloudflare-api-token` in `cert-manager` namespace.

## Known Pulumi Pitfalls

### @pulumiverse/talos provider bump triggers kubernetes cascade

When `@pulumiverse/talos` is upgraded (e.g. via Renovate), run `npm install` in `pulumi/` **before** `pulumi up`. Without it, node_modules is stale and pulumi uses the wrong plugin version.

Even after `npm install`, any `@pulumiverse/talos` version bump causes this cascade in `pulumi preview`:

```text
talosSecrets update [diff: ]          ← provider re-registers resource (values unchanged)
  → talosKubeconfig update            ← kubeconfig re-evaluated with new provider
    → kubernetesProvider replace      ← kubeconfig serialization differs between versions
      → all kubernetes resources delete + recreate
```

The deletes are real — Cilium, FluxOperator, Gateway CRDs get removed from the cluster. FluxCD reconciles them back within minutes, but there is a networking gap while Cilium restarts.

**Before deploying after a talos provider bump:** confirm you understand the cascade and have a window for brief cluster disruption. The cluster itself (Talos nodes, etcd) is unaffected.
