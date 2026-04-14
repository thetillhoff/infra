# Monitoring

- `prometheus/` deploys the standalone Prometheus chart (metrics collection, kube-state-metrics, node-exporter).
- `grafana/` deploys Grafana with provisioned datasources for Prometheus and Loki.
- `loki/` deploys Loki in single-binary mode (log aggregation).
- `alloy/` deploys Grafana Alloy as a log collector (pod logs + cluster events) forwarding to Loki, with metrics forwarding to Prometheus.
- `metrics-server/` provides the Kubernetes metrics API (`kubectl top`).
