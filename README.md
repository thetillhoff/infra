# infra

## The vision `One place to rule them all`
This repository contains several subfolders - each for its own tool:
- `.github`: GitHub Actions workflows.
- `pulumi`: IaC code for DNS and infrastructure workloads like VMs. Also contains the base setup for Kubernetes on Talos, up to the point where FluxCD takes over.
- `ansible`: Configuration management for bare-metal hosts (e.g. ZFS storage server).
- `packer`: Builds the Talos images used for cloud nodes.
- `kubernetes`: Kubernetes manifests (Helm releases, Kustomizations) synced by FluxCD.

## The tools

### Pulumi

Pulumi configures the whole cloud setup (Hetzner Cloud, DNS, Talos cluster bootstrapping, Cilium).
There are some tasks around its usage in the `Taskfile.yaml` of this repo.

### Ansible

Ansible manages bare-metal hosts that aren't part of the Kubernetes cluster (e.g. the `blackhole` storage server).

It can be run in two ways:
- Locally on the target host - clone this repo and follow `ansible/README.md` to install Ansible.
- Remotely from another machine via SSH, either directly or through the provided container image (`ansible/Dockerfile`) so no local Ansible install is required.

Common workflows are wrapped in `ansible/Makefile` (`make run`, `make check`, `make lint`, plus `docker-*` variants that execute inside the container with `~/.ssh` mounted in).
Inventory lives in `ansible/inventory.yaml`; per-host config like `ansible/blackhole.yaml` shows what needs adjusting for new targets.

### Packer

Packer is used to build the Talos images for Hetzner Cloud (amd64 and arm64).
Check out the `packer/README.md`.

### Kubernetes / Talos

The Kubernetes distro of choice is [Talos](https://www.talos.dev/).
Some prerequisites are installed directly via Pulumi (Cilium as CNI, kubelet-csr-approver), but
the actual Kubernetes manifests are deployed/synced by FluxCD.

### FluxCD

FluxCD directly syncs with this repo and deploys what's configured to that specific k8s cluster under `kubernetes/clusters/<clustername>/`.

### Cilium

Cilium is the CNI and also serves as the Gateway API implementation (replacing a traditional ingress controller).
Network policies are managed via `CiliumClusterwideNetworkPolicy` under `kubernetes/infrastructure/resources/firewall/`.

### Renovate

Renovate keeps dependencies up to date for everything FluxCD's image automation doesn't already cover.
Configured in `renovate.json`.

### Secrets (SOPS + AGE)

Secrets are always stored in files. These files are encrypted with SOPS using AGE keys.
FluxCD has a built-in integration with SOPS and there's a nice CLI tool for local editing.

The encryption is configured in `.sops.yaml`.
Use `sops edit <filename>` to view and edit in plaintext.
To encrypt/decrypt in place use `sops encrypt -i <filename>` and `sops decrypt -i <filename>`, respectively.

Default keys can be configured in `~/.config/sops/age/keys.txt` with one private age key per line.
A private key can be set temporarily with `export SOPS_AGE_KEY=<value>` or `SOPS_AGE_KEY=<value> sops ...`.

## Storage

Rook was too complex and had too harsh requirements for a homelab.
[Longhorn](https://longhorn.io/) is used for storage in Kubernetes.
Bare-metal ZFS is used and configured via Ansible for the `blackhole` storage server.

The hostpath provider could be used to integrate ZFS with k8s if needed.

## Cluster components

### Networking / Ingress
- Cilium (CNI + Gateway API + network policies)
- Gateway API resources under `kubernetes/infrastructure/resources/gateways/`

### Certificates
- cert-manager with Let's Encrypt (staging + prod) and a self-signed CA cluster issuer.

### Observability
- Prometheus (metrics)
- Grafana (dashboards)
- Loki (logs)
- Grafana Alloy (metrics/logs collection)
- metrics-server
- Discord notifications via an Alertmanager provider for Flux/k8s alerts.

### VPN
- Tailscale (operator in-cluster + bare-metal hosts via Ansible)

## TODO
- tracing (e.g. grafana-tempo / jaeger)
- https://kubernetes.io/docs/tasks/administer-cluster/dns-horizontal-autoscaling/#enablng-dns-horizontal-autoscaling
- tailscale vpn between blackhole and pegasus (non-k8s)
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/cpu-default-namespace/
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/memory-default-namespace/

## Maintenance
- Ansible modules
  - tailscale
- System -> manual apt-update && apt-upgrade -y
- Kubernetes
  - infra
    - flux
    - cilium (via Pulumi)
    - cert-manager
    - longhorn
    - tailscale operator
    - kubelet-csr-approver
    - monitoring (prometheus, grafana, loki, alloy, metrics-server)
  - apps
    - link-shortener caddy version
    - umami, umami-mariadb -> currently latest, but never pulled again
    - vaultwarden
- Pulumi
  - Provider
- Secret rotation TBD

---

next time:

- retry mtls, and use cilium status afterwards.
- Check kubernetes/TODO.md.
