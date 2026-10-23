# TODO

- Upgrade Talos v1.13.8 -> v1.14.2 by blue/green nodegroup swap (`UPGRADE-TALOS.md`), then Kubernetes v1.36.5 -> v1.37.1. The Packer image exists (snapshot `talos-v1.14.2-amd64`, ID 443210363). Postponed: Hetzner had no cx43 servers available on 2026-10-14. Retry later; the plan is a new nodegroup `hcloud-talos-v1-14-2-controlplane` with that image ID and a copy of the v1.13.8 patch.
- Hold TypeScript 7: `@pulumi/pulumi` rejects it in its peer range. Retry when the SDK allows it.
- Hold `@types/node` at 24 until Node 26 is LTS.
- Delete the unwired directory `kubernetes/apps/hydra/tailscale`. No Kustomization in `clusters/hydra/` references it, and its image tags are stale.
- Pick a dashboard to replace the removed `kubernetes-cluster` entry (gnetId 15520 has only revision 1, an unreviewed third-party template).
- Enable the Longhorn NetworkPolicies again (`networkPolicies.restrictInternalTraffic: true`) with `networkPolicies.metricsScrapeSources` set so Prometheus can still scrape.
- Set `upgrade.crds: CreateReplace` on the tailscale HelmRelease. Helm does not update CRDs from a chart's `crds/` directory on upgrade, so the existing CRDs keep their old schema.
- Decide on the PostgreSQL majors: trading runs 16, manga and umami 17, federated-cloud-platform 18. Each major needs a dump and restore.
- Add a Grafana check that an alert mail arrives. The contact point exists, but no upgrade step sends a test message.
- Pin valkey in manga-scraper: `valkey/valkey:8-alpine` floats. 8.1.10 is the newest 8 tag. Version 9.1.2 is a major bump.
- Upgrade umami from v2.20.2 to v3. Check the v3 image tag format first: the Flux image policy only matches `postgresql-v*`. Take a Longhorn backup of the umami volume before the schema migration.
- Run the umami app (`nextjs` user in the image) as non-root. Check vaultwarden, link-shortener (caddy, port 80) and ib-gateway for non-root as well. Add `runAsNonRoot` to the federated-cloud-platform redis.
