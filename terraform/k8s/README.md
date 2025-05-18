# Manual action after cluster initialization

```sh
kubectl get pods --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,HOSTNETWORK:.spec.hostNetwork --no-headers=true | grep '<none>' | awk '{print "-n "$1" "$2}' | xargs -L 1 -r kubectl delete pod
```

# State interactions

## Retrieve talosconfig from state

```sh
terraform output -raw talosconfig > talosconfig
export TALOSCONFIG="$(pwd)/talosconfig"
```

## Retrieve kubeconfig from state

```sh
terraform output -raw kubeconfig > kubeconfig
export KUBECONFIG="$(pwd)/kubeconfig"
```

## Recreation of everything within the k8s module

```sh
# First, remove the cluster part from state - it's hard to remove those resources, and since the nodes are recreated anyway, removal is not necessary
tf state rm "module.k8s.module.cluster"

# Then either comment out everything in the `k8s.tf` file or run `tf taint "module.k8s.module.config.talos_machine_secrets.main"`

# Finally, apply the changes. If you used taint, a single run is enough, otherwise reapply after reverting the commenting out part.
tf apply
```


# Upgrades


A list of things that need to be updated:

## terraform/k8s/providers.tf
- hcloud provider
- cloudflare provider
- talos provider

## terraform/k8s/cluster/providers.tf
- kubernetes provider
- helm provider
- flux provider

## infra
- talos on nodegroup
- kubernetes cluster version
- cilium
- flux


## Talos upgrade

### Node group replacement

- Update the version in the `packer/amd64.pkrvars.hcl` and `packer/arm64.pkrvars.hcl` files
- Run `export PKR_VAR_HCLOUD_TOKEN=<your-hcloud-token>`
- Run `packer build -var-file=amd64.pkrvars.hcl -color=false talos-on-hcloud.pkr.hcl`
  or `packer build -var-file=arm64.pkrvars.hcl -color=false talos-on-hcloud.pkr.hcl`, depending on the desired architecture of the nodes
- Create an updated `nodegroup-patch/talos-<version>-controlplane-patch.yaml` file
- Add new nodegroup in the `module.k8s` call in `terraform/k8s.tf` - don't forget to update the `talos_image_id` variable
  The image id can be retrieved from the output of the `packer build` command.
- Run `terraform apply` to create a new nodegroup with the new version
If the old one should be removed:
- Reset talos nodes with `talosctl -n <node1-ip> -n <node2-ip> -n <node3-ip> reset`
  This will cordon and drain the node.
  Note that daemonsets cannot be evicted.
  Cordon & drain is similar to taints, but it's done by the node itself.
- Remove node from kubernetes cluster with `kubectl delete node <node-ip>`
- Adjust the `retrieve_talosconfig_from_nodegroup` variable in `terraform/k8s.tf`
- Remove the old nodegroup from the `module.k8s` call in `terraform/k8s.tf`
- Run `terraform apply` to remove the old nodegroup
- Remove old `nodegroup-patch/talos-<old-version>-controlplane-patch.yaml` file

### Node group update

It's probably better to create a new nodegroup with the new version and then remove the old one. The steps are described here anyway.

From https://www.talos.dev/v1.10/talos-guides/upgrading-talos/#supported-upgrade-paths:
> "the recommended upgrade path is to always upgrade to the latest patch release of all intermediate minor releases."
> e.g. 1.0 -> 1.0.6 -> 1.1.2 -> 1.2.4

```sh
talosctl upgrade --nodes <node address> \
  --image ghcr.io/siderolabs/installer:v1.10.0
```


## Kubernetes upgrade

To identify current version:
```sh
kubectl version
```

To upgrade:
```sh
# From https://www.talos.dev/v1.10/kubernetes-guides/upgrading-kubernetes/
talosctl --nodes <controlplane node> upgrade-k8s --to 1.33.0
```


## Cilium upgrade

- Update the `cilium_version` variable in the `terraform/k8s/k8s.tf` file
- Run `terraform apply` to upgrade the cilium version


## Flux upgrade

- Update the `flux_version` variable in the `terraform/k8s/k8s.tf` file
- Run `terraform apply` to upgrade the flux version
