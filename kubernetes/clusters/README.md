# Upgrades

## Via terraform (recommended)

Change `terraform/k8s/cluster/flux.tf`


## Via git

```sh
flux install --components-extra=image-reflector-controller,image-automation-controller --export > ./flux-system/gotk-components.yaml
```
