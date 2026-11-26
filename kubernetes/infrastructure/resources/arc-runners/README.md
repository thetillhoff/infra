# arc-runners

Ephemeral GitHub Actions runners on hydra. Each job gets a new pod, which Kubernetes deletes after the job. The pool scales from 0 to `maxRunners`.

- Controller: `controllers/arc/` (namespace `arc-systems`). Scale set: this directory (namespace `arc-runners`).
- Use it in a workflow with `runs-on: hydra`. The scale set name is the label.
- A personal account has no org-wide scale set. Each repo needs its own scale set: copy this directory, change `githubConfigUrl` and the release name.
- `maxRunners` is a count cap. Requests and limits do not cap the number of pods, and runners share the 3 nodes with the apps.
- The namespace is `privileged` because the `dind` sidecar is privileged. Use the scale set only for private repos that you own.
- The GitHub App credentials are in `github-app.secret.yaml`. The App needs Actions (read), Administration (read and write) and Metadata (read), installed on the repo.
- `values.yaml` sets `controllerServiceAccount` by name. Without it, the chart looks up the controller in the live cluster, and CI cannot render the release.
