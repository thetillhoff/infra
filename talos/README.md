# Usage to manually create necessary files

```
talosctl gen config \
    --with-examples=false \
    --with-docs=false \
    --with-kubespan=true \
    --config-patch @controlplane-patch.yaml \
    --output-types talosconfig,controlplane \
    hydra \
    https://k8s.thetillhoff.de:6443

# Is --with-kubespan=true necessary?

# to be replaced with terraform
flux bootstrap github \
    --owner=thetillhoff --repository=infra --path=kubernetes/clusters/hydra --components-extra=image-reflector-controller,image-automation-controller
```

TODO
- change controlplane url in controlplane.yaml from k8s-hydra.thetillhoff.de to k8s.thetillhoff.de
