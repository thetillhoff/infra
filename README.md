# infra

## The vision `One place to rule them all`
This repository contains several subfolders - each for its own tool:
- .github: Contains Github actions, which call terraform and ansible with their respective folders.
- terraform: Contains terraform code for Cluster-, DNS-, Storage-, Network-provisioning & initial configuration (cloud-init).
- ansible: Contains additional configuration management which terraform is not intended for.
- kubernetes: Contains kubernetes manifests like helm charts and kustomizations.

## The tools
### Terraform
The Terraform code should be formatted, and tested with git-hooks locally.
The Github Action is the actual planner and executor.
The state is stored in Terraform cloud.
The secrets are stored in github (actions), with prefix `TF_VAR_*`.

### Ansible
Ansible playbook can be run from your local machine (ssh auth).
But they are run from a Github Action anyway / as well.
The Ansible inventory is created by Terraform during the Terraform apply step.

### Kubernetes
The Kubernetes distro of choice is k3s.
It's installed with Ansible.
The actual Kubernetes manifests are deployed/synced with FluxCD.

### FluxCD
The FluxCD bootstrap is executed each time the ansible playbook is run.
> FluxCD just "skips" the bootstrap if it was already bootstrapped before.

### Apps

#### Logs

#### Metrics

#### Tracing

#### Storage

#### Backup

#### Certificates

#### VPN / Auth




The flow is like this:
1. Make changes
2. Push to `main` branch
3. Github action is triggered and triggers further modules (terraform, ansible or k8s/none)
4. Check everything works as intended
5. Merge into `prod` branch
6. Github action is triggered and executes the same module as before

### Github actions
They require some setup on Github side. For once, two environments should be created: `prod` and `dev (main)`.
The latter provides the ability to test stuff before putting it live in the `prod` environment.

Many secrets are required in the process. Most are universal, but some are distinct per environment.

#- `KUBENODE_SSH_PRIVATE_KEY`
- `GITHUB_TOKEN` # Automatically set by Github Actions
- `TAILSCALE_AUTH_TOKEN`
- `TERRAFORM_TOKEN`
- `TF_VAR_CLOUDFLARE_APITOKEN`
- `TF_VAR_HCLOUD_TOKEN`
- `TF_VAR_ROOT_DOMAIN`
- `TRANSCRYPT_PASSWORD`

### Kubernetes
There are two options on how to deploy changes:
1. Run kubectl/helm commands from localhost or github action.
  This is harder to setup initially, but easier to debug. Automatic deletion is unsupported this way.
2. Install flux (or different gitops tool) on cluster and let it reconcile automatically. Automatic deletion is supported - but only for k8s-internal resources.
3. k3s supports automatic installation of manifests out of the box.

Option 3 is what this project leverages.

## Retrieve the kubeconfig
`scp -i ~/.ssh/automation.key root@k8s.thetillhoff.de:/etc/kubernetes/admin.conf ./kube-config`
> Use `kubectl --kubeconfig ./kube-config *` from now on.

## Secrets
Secrets are encrypted with `transcrypt` using aes-256-cbc as cipher.
New repositories can be initialized with `./transcrypt`.
Cloned repositories can be initialized with `./transcrypt -c aes-256-cbc -p 'password'`.

## Storage
Several storage providers were tested and were not fitting;
- Rook/Ceph had an internal certificate expiration that was undocumented at the time of writing
- Longhorn relies on UI-interaction for multi-disk configurations

Therefore, bare-metal ZFS is deployed where needed (since so far everythings operates on single-node base).
ZFS is deployed and configured via ansible. Integration with Kubernetes happens via the default kubernetes `hostPath` provider.

## TODO
- secrets,sops,...
- monitoring, logging (grafana, prometheus, openmetrics, fluentd, jaeger-tracing/grafana-tempo)
- take a proper look at rook config (erasure coding, ...)
- https://kubernetes.io/docs/tasks/administer-cluster/dns-horizontal-autoscaling/#enablng-dns-horizontal-autoscaling
- RBAC / access mgmt / proper kubeconfigs
- tailscale vpn between blackhole and pegasus (non-k8s)
- k8s on blackhole
  - cilium
  - ingress-nginx / traefik
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/cpu-default-namespace/
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/memory-default-namespace/

## Maintenance
- Github Action
  - Update runner version
  - Update github action versions in `.github/workflows/apply.yaml`
  - Update cli versions within apply.yaml:
    - Terraform
  - Update github action versions in `.github/workflows/destroy.yaml`
- Ansible modules
  - k3s
  - tailscale
  - fluxcd cli
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
- Terraform
  - Provider
- Secret rotation TBD

## Why `flux` isn't there yet:
I tried it and it had several hickups that in summary rendered it unusable.
- two different types of `kustomization.yaml`s - one the plain kubernetes one, one is flux specific. Feels bad and it's a hassle to mix them.
  - also, why would you need ("required field") to set a custom reconcilation interval for subparts of your application, when you already have a global one?
- many helm charts bring CRDs with them. And in most of those cases, you want to instantiate them as well (ClusterIssuer for cert-manager, CephCluster for rook, ...)
  But flux/kustomization does not support this use case: Before the CRDs are added, the framework tries to instantiate the CRs, which is not possible by that time and the whole deployment fails. Next retry it is the same, so it's not even that CRDs are deployed in the first try and CRs in the second... it just fails repeatedly.
  You don't have that if you first apply the CRDs (push them to the repo), and the resources in the next step, but that is not an idempotent workflow.
- setting values for helm charts is all well and good, but if you change them, they often are not deployed. My guess on the root cause is that the configurations are deployed as configmaps, and updates of their contents don't restart its consumers. That's why flux/kustomize introduced configmapGenerators... But they are obviously not used in helm charts.


Todos from Samba logs:
- weak crypto allowed
- unix password synx is set, but no valid passwd program parameter
