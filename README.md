# infra

## The vision `One place to rule them all`
This repository contains several subfolders - each for its own tool:
- .github: Contains Github actions, which call terraform and ansible with their respective folders.
- terraform: Contains terraform code for Cluster-, DNS-, Storage-, Network-provisioning & initial configuration.
- ansible: Contains additional configuration management which terraform is not intended for.
- kubernetes: Contains kubernetes manifests like helm charts and kustomizations.

The flow is like this:
1. Make changes
2. Push to `main` branch
3. Github action is triggered and triggers further modules (terraform, ansible or k8s/none)
4. Check everything works as intended
5. Merge into `prod` branch
6. Github action is triggered and executes the same module as before

### Github actions
They require some setup on github side. For once, two environments should be created: `prod` and `dev (main)`.
The latter provides the ability to test stuff before putting it live in the `prod` environment.

Many secrets are required in the process. Most are universal, but some are distinct per environment.

`TF_VAR_DNS_SUFFIX`

### Kubernetes
There are two options on how to deploy changes:
1. Run kubectl/helm commands from localhost or github action.
  This is harder to setup initially, but easier to debug. Automatic deletion is unsupported this way.
2. Install flux (or different gitops tool) on cluster and let it reconcile automatically. Automatic deletion is supported - but only for k8s-internal resources.


## Retrieve the kubeconfig
`scp -i ./id_ed25519 root@k8s.thetillhoff.de:/etc/kubernetes/admin.conf ./kube-config`
> Use `kubectl --kubeconfig ./kube-config *` from now on.


## Install Metallb (required for external access on lower ports)
> Note, that metallb requies the IP in CIDR (a.b.c.d/32) format instead of range with equal start-end ip (worked with v0.9.3).

> There is currently a bug with the metallb helm charts (https://github.com/metallb/metallb/issues/1102). Current workaround it so use the manifests directly.

## Secrets
There are several `*.gpg` files in this repository. They were encrypted symmetrically with gpg.
The command used for encryption is `find . -name '*.gpg' -exec gpg --batch --yes --cipher-algo AES256 --passphrase '<password>' -o '{}.gpg' --symmetric '{}' \;`.
The command for decrypting them is `find . -name '*.gpg' -exec gpg --batch --yes --decrypt --passphrase '<password>' -o '{}' '{}' \;`.
> Encrypting will add the `.gpg` file extension to each file.
> Decryption will overwrite the existing file.

## Storage
Several storage providers were tested and were not fitting;
- Rook/Ceph had an internal certificate expiration that was undocumented at the time of writing
- Longhorn relies on UI-interaction for multi-disk configurations

Therefore, bare-metal ZFS is deployed where needed (since so far everythings operates on single-node base).
ZFS is deployed and configured via ansible. Integration with Kubernetes happens via the default kubernetes `hostPath` provider.

## TODO
- mariadb with persistence
- vaultwarden that uses external mariadb
- secrets,sops,...
- monitoring, logging (grafana, prometheus, openmetrics, fluentd, jaeger-tracing/grafana-tempo)
- take a proper look at rook config (erasure coding, ...)
- ? tekton
- https://kubernetes.io/docs/tasks/administer-cluster/dns-horizontal-autoscaling/#enablng-dns-horizontal-autoscaling
- RBAC / access mgmt / proper kubeconfigs
- tailscale vpn between blackhole and pegasus (non-k8s)
- storage:
  - reimport zfs on blackhole
    rook-nfs -> expose hostpath as nfs
- k8s on blackhole
  - cilium
  - metallb
  - ingress-nginx / traefik
  - ? rook-cephfs -> expose backup location etc.
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/cpu-default-namespace/
- https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/memory-default-namespace/

## Why `flux` isn't there yet:
I tried it and it had several hickups that in summary rendered it unusable.
- two different types of `kustomization.yaml`s - one the plain kubernetes one, one is flux specific. Feels bad and it's a hassle to mix them.
  - also, why would you need ("required field") to set a custom reconcilation interval for subparts of your application, when you already have a global one?
- many helm charts bring CRDs with them. And in most of those cases, you want to instantiate them as well (ClusterIssuer for cert-manager, CephCluster for rook, ...)
  But flux/kustomization does not support this use case: Before the CRDs are added, the framework tries to instantiate the CRs, which is not possible by that time and the whole deployment fails. Next retry it is the same, so it's not even that CRDs are deployed in the first try and CRs in the second... it just fails repeatedly.
  You don't have that if you first apply the CRDs (push them to the repo), and the resources in the next step, but that is not an idempotent workflow.
- setting values for helm charts is all well and good, but if you change them, they often are not deployed. My guess on the root cause is that the configurations are deployed as configmaps, and updates of their contents don't restart its consumers. That's why flux/kustomize introduced configmapGenerators... But they are obviously not used in helm charts.
