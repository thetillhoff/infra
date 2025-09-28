# How to upgrade the kubernetes version

## 1. 

- Check the Kubernetes release page for the exact version you want to upgrade to and read the changelogs up to it.
- Run `task upgrade-k8s -- <version>`. Although this uses a specific node, it upgrades the whole cluster.
