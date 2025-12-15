# How to upgrade the kubernetes version

- Check the Kubernetes release page for the exact version you want to upgrade to and read the changelogs up to it.
  <https://kubernetes.io/releases/>
- Run `task upgrade-k8s -- <version>`. Although this uses a specific node, it upgrades the whole cluster.

Copy the new kubernetes version into `pulumi/index.ts` and run `task deploy` to ensure there's no drift.
