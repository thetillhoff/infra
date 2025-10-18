# infra

## The vision `One place to rule them all`
This repository contains several subfolders - each for its own tool:
- .github: Contains Github actions, which call terraform and ansible with their respective folders.
- pulumi: Contains IaC code for DNS, and infrastructure workloads like VMs. It also contains a base setup for Kubernetes on Talos, up to the point where FluxCD starts.
- ansible: Contains additional configuration management which terraform is not intended for.
- kubernetes: Contains kubernetes manifests like helm charts and kustomizations.

## The tools

### Pulumi

Pulumi configures the whole cloud setup.
There are some tasks around its usage in the `Taskfile.yml` of this repo.

### Ansible

Ansible is currently configured to run from the target system itself.
So clone this repo, and check the `ansible/README.md`.

It can also be run from another machine in the same network via SSH.
Check out the config in `ansible/blackhole.yaml` for insights on what needs to be adjusted.

### Kubernetes

The Kubernetes distro of choice is talos.
Some prerequisites are installed directly via pulumi, but
the actual Kubernetes manifests are deployed/synced by FluxCD.

### FluxCD

FluxCD directly syncs with this repo and deploys what's configured to that specific k8s cluster under `kubernetes/<clustername>/`.

### Secrets

Secrets are always stored in files. These files are encrypted with SOPS.
FluxCD has an integration with it and there's a nice cli-tool for it.
The underlying encryption is using AGE.

The encryption is configured in the `.sops.yaml`.
Use `sops edit <filename>` to view and edit it in plaintext.
To encrypt/decript in place use `sops encrypt -i <filename>` and `sops decrypt -i <filename>`, respectively.

Default keys can be configured in `~/.config/sops/age/keys.txt` with one private age key per line.
A private key can be set temporarily with `export SOPS_AGE_KEY=<value>`.

## Storage

Rook was too complex and had too harsh requirements for a homelab.
Longhorn is used for the cloud setup.
Bare-metal ZFS is used and configured via ansible.

The hostpath provider could be used to integrate zfs with k8s if needed.

### Apps

#### Logs

#### Metrics

#### Tracing

#### Backup

#### Certificates

#### VPN / Auth


## TODO
- monitoring, logging (grafana, prometheus, openmetrics, fluentd, jaeger-tracing/grafana-tempo)
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
    - ingress-nginx
    - cert-manager
  - apps
    - link-shortener caddy version
    - umami, umami-mariadb -> currently latest, but never pulled again
    - vaultwarden
- Pulumi
  - Provider
- Secret rotation TBD
