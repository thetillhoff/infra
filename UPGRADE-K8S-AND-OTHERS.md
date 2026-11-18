# How to upgrade the Kubernetes version and installed apps

## Kubernetes

- Check the changelog for breaking changes for each minor version between current and target:
  `https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG/CHANGELOG-<major>.<minor>.md`
- Check the Talos support matrix to confirm the target version is supported:
  `https://www.talos.dev/v<talos-version>/introduction/support-matrix/`
- Run `task upgrade-k8s -- <version>` (targets a random controlplane node but upgrades the whole cluster).
- Verify all nodes are on the new version: `kubectl get nodes`
- Update `versions.kubernetes` in `pulumi/index.ts` to match.
- Run `task deploy` to ensure no drift.

## Other versions (Cilium, FluxOperator, Gateway API CRDs)

Renovate opens a pull request for each new version in `pulumi/index.ts` and does not merge it: the version is live only after `task deploy`. Merge the pull request only when you deploy it, so that `main` matches the cluster. Flux itself follows `2.x` and needs no step.

- Read the changelog. For the Gateway API CRDs, check that the Cilium version in use supports the new version.
- Merge the pull request, then run `task deploy`.
- After a Cilium upgrade or a change of `pulumi/cilium-values.yaml`, run `kubectl -n kube-system rollout restart ds/cilium`. The Helm upgrade does not restart the agents.

  > **Helm repo error:** If deploy fails with `unable to locate chart: no cached repo found`, run `helm repo add cilium https://helm.cilium.io/ && helm repo update`, then retry.
