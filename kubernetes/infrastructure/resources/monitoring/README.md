# Monitoring

- `prometheus/` deploys the standalone Prometheus chart (metrics collection, kube-state-metrics, node-exporter).
- `grafana/` deploys Grafana with provisioned datasources for Prometheus and Loki.
- `loki/` deploys Loki in single-binary mode (log aggregation).
- `alloy/` deploys Grafana Alloy as a log collector (pod logs + cluster events) forwarding to Loki.
- `metrics-server/` provides the Kubernetes metrics API (`kubectl top`).

## Hubble flows

- L7 flows contain full `Cookie` and `Authorization` values and URL query strings. The ring buffer in memory is fine for that, but never export flows unredacted to Loki. `hubble.redact` in `pulumi/cilium-values.yaml` is a header allowlist: add to it on purpose, and never change it to a denylist.
- Cilium Gateway API is Envoy in host-network mode. Envoy ends the client connection, so L3/L4 flows show `reserved:ingress` and never the client. The client IP is in `IP.source` on the L7 flows (`http-request`, `http-response`) only. The two rows of one request cannot be matched by port. `hubble observe --protocol http` is the clean access log.
- `hubble.metrics` httpV2 leaves out `source_ip` on purpose (cardinality). Prometheus has no client IPs.
- `hubble.export.static` writes L7 flows to the stdout of the agent. Alloy tails that, so Loki holds the durable access log. The ring buffer holds only about 35 s. `filePath: stdout` is a literal value: a real path would write a file that Alloy cannot see.

```logql
{container="cilium-agent"} |= "\"REQUEST\"" | json
  | line_format "{{.flow_IP_source}} -> {{.flow_destination_namespace}}/{{.flow_destination_pod_name}} {{.flow_l7_http_method}} {{.flow_l7_http_url}}"
```

## Loki

Check a change of the Loki config before you push: render the chart with `helm template`, then run `loki -verify-config` on the rendered `config.yaml` in Docker. With `deploymentMode: Monolithic` the compactor runs in the process. The top-level `compactor.replicas: 0` does not turn it off.

## Prometheus

- The memory of Prometheus follows the number of active series, not the retention. Per-IP labels in the Hubble `httpV2` metrics and `port-distribution` were about 90k series. They are trimmed in `pulumi/cilium-values.yaml`.
- A scrape annotation (`prometheus.io/port`) on a Service must name the container port, not the Service port. The job `kubernetes-service-endpoints-by-port-name` (`prometheus/values.yaml`) uses the `endpointslice` role.

## Grafana dashboards

An init container downloads each `dashboards:` entry from grafana.com (`gnetId` and `revision`). Since chart 13 the script runs with `pipefail`, so an entry with a missing revision crashes the init container and blocks the rollout. Before you add one, check that `https://grafana.com/api/dashboards/<id>/revisions/<rev>/download` returns 200.

## Alert mail has two paths

Grafana alerts use the SMTP settings of Grafana. The Prometheus rules (`serverFiles` in `prometheus/values.yaml`) go through the Prometheus Alertmanager, which reuses the `grafana-smtp` secret. To alert on a new app, add a rule there. Prometheus holds the alert state. Flux events are not used: they carry no end time, so the alert expired and fired again at every reconcile.

| Rule | Fires when | After |
| ---- | ---------- | ----- |
| `FluxResourceNotReady` | Any Flux resource is not ready (reads `flux_resource_info` of the Flux Operator) | 5m |
| `WorkloadUnavailable` | A Deployment, StatefulSet or DaemonSet has unavailable replicas | 15m |
| `PodCrashLooping` | A container is in `CrashLoopBackOff` | 10m |

- Alertmanager has no authentication. A NetworkPolicy admits only the Prometheus server on `:9093`. Add any new sender there.
- An alert sends one mail, then a reminder every 24 hours, then one mail when it resolves. Each alert is its own mail.
- A Flux resource that waits on a failed dependency does not alert. The dependency does.
- Failed Jobs have no rule: `kube_job_failed` keeps old failed Jobs, so a rule would mail about them at once.
- The chart default `extraFlags` holds `web.enable-lifecycle`. Our override must keep it, or the reload sidecar gets 403 and a change of a rule needs a pod restart.
- Check a change of a rule before you push: render the chart with `helm template` and run `promtool check rules` on the rendered `alerting_rules.yml` in Docker. A wrong key (`serverFiles` is top-level, not under `server:`) renders an empty `{}` without an error. After the rollout, `/api/v1/rules` of Prometheus must list the rule.
- Test the path with a throwaway Kustomization (`interval: 1m`, `path: ./does-not-exist`, `prune: false`). The alert fires after about 5 minutes. Delete the Kustomization afterwards: the resolved mail follows within about 2 minutes. The counter `alertmanager_notifications_total{integration="email"}` on `:9093/metrics` rises by one per mail. Through the API-server proxy this call can time out because of the NetworkPolicy: retry.

## Prometheus hardening

- Prometheus has no authentication. `networkPolicy-prometheus.yaml` admits only Grafana on `:9090`, because `web.enable-lifecycle` exposes `/-/quit`. The remote-write receiver is off: nothing pushes metrics to Prometheus. Add any new client there. The chart's own `networkPolicy.enabled` allows `:9090` from every source, so it is not used.
- The policy blocks `kubectl get --raw .../services/prometheus-server:80/proxy/...` (the API server is not an allowed client). Use `kubectl port-forward` instead.
- The server and the reload sidecar run with a read-only root filesystem and no capabilities. Only `/data` is writable. A new flag or feature that writes elsewhere needs its own `emptyDir`.
- The Alertmanager chart sets the same restrictions by default.
