# How to upgrade the Kubernetes version and installed apps

## Kubernetes

- Run `task upgrade-k8s -- <version>` (targets a random controlplane node but upgrades the whole cluster).
- Update `versions.kubernetes` in `pulumi/index.ts` to match.
- Run `task deploy` to ensure no drift.

## Other versions (Cilium, FluxOperator, Flux, Gateway API CRDs)

- Check latest versions via the links in comments next to each version in `pulumi/index.ts`.
- Read changelogs before bumping.
- Update the values in `pulumi/index.ts`.
- Run `task deploy`.

  > **Helm repo error:** If deploy fails with `unable to locate chart: no cached repo found`, run `helm repo add cilium https://helm.cilium.io/ && helm repo update`, then retry.
