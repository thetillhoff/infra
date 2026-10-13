# TODO

- Upgrade Kubernetes (v1.36.2 in `pulumi/index.ts`, `alpine/k8s:1.36.2` in 3 manifests) and Talos (`packer/common.pkrvars.hcl`) after `UPGRADE-K8S-AND-OTHERS.md` and `UPGRADE-TALOS.md`. Build the Talos image with the new Packer first.
- Hold TypeScript 7: `@pulumi/pulumi` rejects it in its peer range. Retry when the SDK allows it.
- Hold `@types/node` at 24 until Node 26 is LTS.
- Delete the unwired directories `kubernetes/apps/hydra/tailscale` and `kubernetes/apps/base/rook-ceph`. No Kustomization in `clusters/hydra/` references them, and their image tags are stale.
- Pick a dashboard to replace the removed `kubernetes-cluster` entry (gnetId 15520 has only revision 1, an unreviewed third-party template).
- Enable the Longhorn NetworkPolicies again (`networkPolicies.restrictInternalTraffic: true`) with `networkPolicies.metricsScrapeSources` set so Prometheus can still scrape.
- Set `upgrade.crds: CreateReplace` on the tailscale HelmRelease. Helm does not update CRDs from a chart's `crds/` directory on upgrade, so the existing CRDs keep their old schema.
- Decide on the PostgreSQL majors: trading runs 16, manga and umami 17, federated-cloud-platform 18. Each major needs a dump and restore.
- Add a Grafana check that a Discord alert arrives. The contact point exists, but no upgrade step sends a test message.
