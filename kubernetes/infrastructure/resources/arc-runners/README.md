# arc-runners

Ephemeral GitHub Actions runners on hydra. Each job gets a new pod, which Kubernetes deletes after the job. The pool scales from 0 to `maxRunners`.

- Controller: `controllers/arc/` (namespace `arc-systems`). Scale set: this directory (namespace `arc-runners`).
- Use a scale set in a workflow with `runs-on: hydra-<repo>`. The scale set name is the label.
- A scale set registers at repo, org or enterprise level, and a personal account has no org. Each repo needs its own scale set. To add one: copy `helmRelease-manga-scraper.yaml` and `values-manga-scraper.yaml`, change the names and `githubConfigUrl`, then add both to `kustomization.yaml`. `values.yaml` holds what all scale sets share.
- `maxRunners` is a count cap. Requests and limits do not cap the number of pods, and runners share the 3 nodes with the apps.
- The namespace is `privileged` because the `dind` sidecar is privileged. Use the scale set only for private repos that you own.
- Runner pods may reach only the internet and kube-dns, and nothing reaches them. The policy blocks the cluster, the nodes and the metadata service. Test: `curl --max-time 5` to the API server service IP from a runner pod must time out (exit 28).
- The GitHub App credentials are in `github-app.secret.yaml`. The App needs Actions (read), Administration (read and write) and Metadata (read), installed on the repo.
- `values.yaml` sets `controllerServiceAccount` by name. Without it, the chart looks up the controller in the live cluster, and CI cannot render the release.
