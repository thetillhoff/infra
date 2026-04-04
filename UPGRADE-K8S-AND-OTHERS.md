# How to upgrade the kubernetes version and installed apps

- Go into `pulumi/index.ts`, and check out the versions there. Each one has a link in a comment next to it, where you can find the latest versions. Replace them as desired and make sure to read the changelogs.

- Run `task upgrade-k8s -- <version>`. Although this uses a specific node, it upgrades the whole cluster.

- Run `task deploy`. This will


Copy the new kubernetes version into `pulumi/index.ts` and run `task deploy` to ensure there's no drift.
