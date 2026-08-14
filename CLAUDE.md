# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tool homelab infra repo. Cluster name: `hydra`. Domain: `thetillhoff.de`. Tools:

- **`pulumi/`** — IaC: Hetzner Cloud VMs, Cloudflare DNS, Talos bootstrap, Cilium install, FluxCD bootstrap
- **`kubernetes/`** — GitOps manifests synced by FluxCD (Helm releases, Kustomizations, app deployments)
- **`ansible/`** — Config management for bare-metal hosts (e.g. `blackhole` storage server)
- **`packer/`** — Builds Talos Linux images for Hetzner Cloud (amd64/arm64)

Standalone Raspberry Pis (not in the cluster) have their own root-level setup docs: `magic-mirror-setup.md`, `homeassistant-setup.md` (Home Assistant OS + Caddy2 reverse proxy).

## Commands

### Pulumi (run from `pulumi/`)

```sh
pulumi preview          # dry-run
pulumi up               # deploy
npm run format          # prettier — see caution below
```

> **`npm run format` = `prettier --write .`** — reformats the *whole tree*, including `cilium-values.yaml`
> and the `configPatches/*.yaml` files. Reindenting a comment in a nodegroup patch changes the string fed to
> `talos.machine.ConfigurationApply` → a spurious `~ update` re-apply against the **live** controlplanes on the
> next `pulumi up`. Format scoped files only, or revert unrelated reformats (`git checkout -- <file>`) before deploying.

### Taskfile (run from repo root)

```sh
task configure-env | source /dev/stdin   # set TALOSCONFIG, KUBECONFIG, SOPS_AGE_KEY_FILE env vars
task configure-files                     # write talosconfig + kubeconfig files to pulumi/
task deploy                              # pulumi up
task build ARCH=amd64                    # build packer image (token auto-sourced from pulumi config)
task reconcile                           # force-reconcile all flux kustomizations (--with-source)
task delete-nodes -- <node1> <node2>    # drain + remove nodes before server deletion
task upgrade-k8s -- 1.33.0             # upgrade k8s version via talosctl
```

### Ansible (run from `ansible/`)

```sh
make run          # apply playbook (blackhole.yaml by default)
make check        # dry-run
make lint         # syntax check + ansible-lint
make docker-build # build container image
make docker-run   # run playbook in container (mounts ~/.ssh)
```

### Secrets (SOPS + AGE)

```sh
sops edit <file>              # edit encrypted file in-place
sops encrypt -i <file>        # encrypt in-place
sops decrypt -i <file>        # decrypt in-place
export SOPS_AGE_KEY_FILE=$(pwd)/age.key  # or use task configure-env
```

Secret files matching `*secret*` or containing `data`/`stringData` keys are auto-encrypted per `.sops.yaml`.

## Architecture

### Pulumi → FluxCD handoff

Pulumi provisions Hetzner Cloud nodes, configures Talos, bootstraps the cluster, then installs Cilium + FluxCD. After that, FluxCD takes over: it watches this repo and applies everything under `kubernetes/`.

Pulumi components:

- `HcloudTalosNodegroup` — creates HCloud servers + Cloudflare DNS A/AAAA records per node, applies Talos machine config
- `HcloudTalosCluster` — bootstraps Talos, generates kubeconfig, installs Gateway API CRDs + Cilium + Flux Operator + FluxInstance

Pulumi secrets required in stack config: `flux.git-auth` (deploy token), `flux.sops-age` (private AGE key for FluxCD to decrypt secrets at runtime).

### FluxCD sync order (Kustomizations)

```text
flux-system
  └── infrastructure-controllers   (kubernetes/infrastructure/controllers/)
        └── resource-*             (one per kubernetes/infrastructure/resources/<component>/)
  └── app-*                        (one per kubernetes/apps/hydra/<app>/)
```

Kustomizations are **per component and per app**, not two big ones — a broken app or component can't
block unrelated deploys. Names match the entrypoint filenames in `kubernetes/clusters/hydra/`, e.g.
`resource-private-endpoints`, `app-trading`. `flux get kustomizations` lists the live set; there is no
`infrastructure-resources` or `apps` Kustomization. All use SOPS decryption via the `sops-age` secret.

### Kubernetes manifest layout

```text
kubernetes/
  clusters/hydra/          # FluxCD Kustomization entrypoints
  infrastructure/
    controllers/           # HelmReleases: cert-manager, external-dns, longhorn, tailscale operator, kubelet-csr-approver
    resources/             # Cluster resources: cert-manager issuers, gateways, firewall policies, monitoring, discord alerts, private-endpoints
  apps/
    hydra/                 # Per-app dirs: link-shortener, vaultwarden, umami, thetillhoff-de, tailscale, trading, federated-cloud-platform, manga-scraper
```

`kubernetes/apps/hydra/manga-scraper/` runs the manga scraper: postgres + api + ui, with the schema applied by a migrations initContainer (atlas image built by that repo's CI, so the database follows the image). Reachable only at `manga.internal.thetillhoff.de` — its UI has unauthenticated buttons that start crawls, so a public route would let anyone drive the cluster's headed Chromium at third-party sites. The api runs Chromium: single replica (its per-source crawl lock is in-process), 1.5Gi limit, 256Mi `/dev/shm`, and a namespace ResourceQuota.

`kubernetes/apps/hydra/trading/` is the **source of truth for the trading app on hydra** (Flux `app-trading`). The `~/code/trading` repo's `k8s/`/`services/` manifests are **local-dev (kind) only** and intentionally diverge — never edit them expecting a hydra change.

Each app dir typically contains: namespace, deployment/statefulset, service, HTTPRoutes (http+https), imagePolicy + imageRepository + imageUpdateAutomation (for FluxCD image automation), and optionally `*.secret.yaml` (SOPS-encrypted).

### Networking / Ingress

Cilium is both the CNI and the Gateway API implementation (no separate ingress controller). Apps expose themselves via `HTTPRoute` resources referencing Gateways in `kubernetes/infrastructure/resources/gateways/`. Network policies use `CiliumClusterwideNetworkPolicy` in `kubernetes/infrastructure/resources/firewall/`.

Note: the `CiliumClusterwideNetworkPolicy` in `firewall/` uses `nodeSelector: {}` — it is a **node/host** firewall, not a pod-to-pod policy. There is no pod-level default-deny, so cross-namespace pod traffic is unrestricted.

### Private endpoints (tailnet-only)

Admin UIs (grafana, longhorn, hubble) and the two app UIs that must not be public (trading, manga) are exposed privately at `<name>.internal.thetillhoff.de` — reachable only over the Tailscale tailnet, not the public internet. Defined in `kubernetes/infrastructure/resources/private-endpoints/`.

Per app: a small **Caddy** reverse-proxy (non-root, binds `:8443`) terminates a real LetsEncrypt cert (cert-manager DNS-01, per-name `Certificate`) and proxies to the in-cluster app Service. A `Service` `type: LoadBalancer, loadBalancerClass: tailscale` makes the tailscale operator join a proxy to the tailnet and write the private `100.x` (CGNAT) IP into the Service's LB status. **external-dns** (in the `cert-manager` namespace, reusing that namespace's `cloudflare-api-token`) reads the LB IP and creates the `A` record. Security is the WireGuard mesh + tailnet ACLs — the public resolves the DNS but cannot route to `100.64.0.0/10`.

All proxies share the same caddy image automation (`imageRepository`/`imagePolicy`/`imageUpdateAutomation` in that dir). Adding an endpoint = copy a `certificate`/`configMap`/`deployment`/`service` quartet + wire into `kustomization.yaml`.

`home.internal.thetillhoff.de` is the index of all the others. Its pod runs a kubectl sidecar that lists the namespace's Services every 60s and renders one link per `external-dns.alpha.kubernetes.io/hostname` annotation, so a new endpoint appears there with no extra step — that annotation is the only source of truth.

### Storage

Longhorn for persistent volumes in Kubernetes. Bare-metal ZFS on `blackhole` (managed via Ansible).

### Versions

Version constants (kubernetes, cilium, gatewayApiCrds, fluxOperator, flux) are centralized in `pulumi/index.ts`.
Talos version lives in `packer/common.pkrvars.hcl` + the nodegroup name (`hcloud-talos-vX-Y-Z-controlplane`).

**Only ever upgrade to GA versions** — no alpha/beta/rc. Check each project's releases page for the latest
GA before bumping; a "next minor" that isn't GA yet (k8s/Talos often lag each other) is out of scope until released.

## Known Gotchas

### kubectl/flux context

Default kubeconfig context may be a local kind cluster, not hydra. Always run `eval "$(task configure-env)"` before any kubectl/flux commands.

### Memory pressure — batch bursts can OOM the whole cluster

3 control-plane nodes, no workers. **cx43 (8 vCPU / 16 GB) since 2026-08-06** — was cx33/8 GB;
RAM doubled via a blue/green nodegroup swap. Baseline is still heavy: prometheus ~2.75GB, 3×
kube-apiserver 1.6-3.9GB, Longhorn, Cilium. A big enough spike can still hit the kernel OOM-killer.

- 2026-07-13: a large trading grid (~2082 pods) tipped nodes into **global OOM** → killed
  kube-apiserver, kubelet (node-0 went NotReady), longhorn-manager → cascade (Longhorn volumes
  detached, postgres down, Cilium/flux crashlooping). Recovery: hard-reset node-0, then the cluster
  self-heals as memory frees + the failed workload is cleaned.
- **Recover an unresponsive Talos node** via a **Hetzner hard reset** (console or `hcloud server
  reset`) — if `apid` is dead, `talosctl reboot` can't reach it.
- **Longhorn-manager was BestEffort** (no resource requests) → first OOM victim (~500 restarts/25d).
  Fixed: `defaultSettings.priorityClass: system-node-critical` in the Longhorn `values.yaml`.
- **Prometheus RAM = active-series cardinality** (in-memory head block), NOT retention/disk. Hubble
  `httpV2` per-IP labels + `port-distribution` were ~90k series — trimmed in `pulumi/cilium-values.yaml`
  (Cilium is Pulumi-managed; `pulumi up` + a `kubectl rollout restart daemonset cilium` to pick it up).
- Capacity fix applied 2026-08-06: cx33→cx43 (8→16 GB/node) via blue/green nodegroup swap. Batch
  workloads still quota-bounded (the `trading` namespace has a ResourceQuota) — headroom is bigger, not infinite.

### Blue/green node replacement — Longhorn data safety

Swapping the whole controlplane nodegroup (cx33→cx43, or a Talos bump) via `UPGRADE-TALOS.md`: the drain
migrates Longhorn replicas **only for attached volumes** — `nodeDrainPolicy: block-for-eviction` blocks
the drain until each replica rebuilds on a surviving node. It **skips detached volumes** (no running
engine → nothing to copy), so a detached volume whose replicas sit only on the outgoing nodes is lost.

- Detached shows as `ROBUSTNESS: unknown` in `kubectl -n longhorn get volumes.longhorn.io`. Before draining,
  **attach each detached volume in maintenance mode** (Longhorn UI) so it rebuilds onto the new nodes.
- Delete old nodes **one at a time**, verifying all volumes `healthy` between each.
- `task delete-nodes`' interactive prompt can't be answered from a non-interactive shell — script the raw
  `kubectl cordon` + `kubectl drain --ignore-daemonsets --delete-emptydir-data` + `talosctl reset
  --system-labels-to-wipe STATE --system-labels-to-wipe EPHEMERAL --wait=false` + `kubectl delete node`.
- The old nodegroup's Cloudflare A/AAAA records (per clusterDnsName, per node) live until the final
  `pulumi up` removes them — until then public DNS round-robins to the dead node IPs (~50% failed conns).
  Run the old-nodegroup-removal `pulumi up` promptly after the nodes are gone.

### Private endpoints require out-of-band Tailscale config

The `private-endpoints` manifests are inert until the tailnet is set up (done in the Tailscale admin console, not this repo):

- The operator's OAuth client (`operator-oauth.secret.yaml`) must be allowed to create devices with the proxy tag (`tag:service`, set via Service annotation).
- Tailnet **ACLs** must grant your user access to `tag:service` devices on port `443` — otherwise the `100.x` IP resolves but connections are refused. This is the actual access control; DNS is not.

### Private endpoints must not offer HTTP/3 (iOS hangs)

The proxies bind `https_port 8443` and the tailscale `Service` forwards **TCP/443 only**. Caddy's default h3
support then advertises `alt-svc: h3=":8443"` — a port that is neither what the client dialled nor forwarded
at all, so QUIC black-holes. Chrome/Firefox race QUIC against TCP and fall back in milliseconds; **WebKit
(every iOS browser) sticks with the cached Alt-Svc and just spins**, which is why a page loads on mac/linux
and hangs on iPhone. Every `configMap-*-caddy.yaml` therefore sets `servers { protocols h1 h2 }` — keep it
when adding an endpoint.

WebKit persists the Alt-Svc entry for the advertised `ma` (30d), so after fixing the server, an
already-poisoned iPhone needs *Settings → Safari → Clear History and Website Data* (a Private tab uses an
ephemeral store, which makes it the cheap test).

Caddy does **not** watch its Caddyfile, and these are plain ConfigMaps (no `configMapGenerator` hash), so
Flux applying a Caddyfile change restarts nothing:

```sh
kubectl -n private-endpoints rollout restart deployment --all
```

### Cilium Gateway API — PROGRAMMED: False is normal

Gateways always show `PROGRAMMED: False / AddressNotAssigned` — expected, not a bug. Cilium runs in host-network mode (`pulumi/cilium-values.yaml`): Envoy daemonset binds directly to node IPs; no LoadBalancer IP is ever written to `.status.addresses`. Verify health via Envoy daemonset pods + actual HTTP response, not gateway status.

### cert-manager Gateway TLS mechanics

TLS is annotation-driven: `cert-manager.io/cluster-issuer` on a Gateway causes cert-manager to auto-create Certificates per listener. Listeners sharing the same `certificateRefs[0].name` → one multi-SAN cert; unique names → separate certs (one per app).

DNS-01 required for any non-public gateway (HTTP-01 requires ACME server to reach the cluster). Cloudflare DNS-01 token: `Zone › DNS › Edit` scoped to `thetillhoff.de` only, stored as Secret `cloudflare-api-token` in `cert-manager` namespace.

### selfsigned-ca lifetime must exceed hubble leaf renewal interval

`hubble.tls.auto.method: certmanager` (in `pulumi/cilium-values.yaml`) issues hubble certs off the `selfsigned-ca` ClusterIssuer. cert-manager embeds a **snapshot** of the CA cert in each leaf's `ca.crt` and only refreshes it when the leaf re-issues. So the CA must outlive the leaf renewal cycle, else it rotates out from under the leaves and hubble-relay's trust bundle expires → `x509: certificate has expired` → CrashLoopBackOff → hubble-relay Service never Ready → **`task deploy` fails on the Service await** (surfacing as `resource monitor shut down` / `grpc: client connection is closing`, both red herrings). Current: CA `duration: 8760h` (1y, `certificate-selfsigned-ca.yaml`) + leaf `certValidityDuration: 30` (30d). Blast radius of the CA is only the two hubble certs — everything else uses `letsencrypt-prod`.

Force-reissue recovery (cert-manager won't early-renew if `renewBefore` exceeds the current short cert's life): delete `selfsigned-ca-secret` (cert-manager), then `hubble-server-certs` + `hubble-relay-client-certs` (kube-system), then `rollout restart daemonset/cilium deployment/hubble-relay`.

### `pulumi up` alone does not apply a cilium-values.yaml change

It rewrites the `cilium-config` ConfigMap but leaves the daemonset untouched, and the agent reads most flags **only at startup**. So the ConfigMap shows the new value while every agent still runs the old behaviour — verified the hard way with `hubble.redact`: config correct, pods 7d old, credentials still logged. Always follow with:

```sh
kubectl -n kube-system rollout restart daemonset cilium
kubectl -n kube-system rollout status daemonset cilium
```

Check `kubectl -n kube-system get pods -l k8s-app=cilium` ages against the deploy time before trusting any values change — and verify the behaviour, not the ConfigMap.

### Hubble records request headers verbatim — never persist flows unredacted

L7 flows include full `Cookie` / `Authorization` values and URL query strings (verified with a canary request). Fine in the in-memory ring buffer, which turns over in minutes; a hard no once anything exports flows to Loki. `hubble.redact` in `pulumi/cilium-values.yaml` uses a header **allowlist** — add to it deliberately, and never convert it to a denylist.

### Client IP at the ingress is only on L7 flows

Cilium Gateway API = Envoy in host-network mode. Envoy terminates the client TCP connection, so **L3/L4 flows show `reserved:ingress` (identity 8)** with the node's cilium `ingress` IP (`cilium-dbg status --all-addresses`), never the client. The real client IP is in `IP.source` on the `http-request`/`http-response` (L7, `event_type.type: 129`) flows only. The world→node hop is not observed at all — Envoy binds in the host netns and no host firewall is enabled.

Consequences: the Hubble UI **service map** always draws "ingress" (it groups by identity, not IP) — the client IP is visible only in the flow table's detail pane. The two rows for one request **cannot be correlated by port** (the L7 row carries the client's port, the L3 row Envoy's upstream port); only timestamp + destination pod. `hubble observe --protocol http` is the clean access-log view. Ratio measured on one namespace: 1 L7 row per ~324 L3/L4 rows.

`hubble.metrics` httpV2 deliberately omits `source_ip` (cardinality) — Prometheus has no client IPs by design.

### Durable access log: hubble flow export → Loki

`hubble.export.static` (in `pulumi/cilium-values.yaml`) writes L7-only flows to the agent's stdout, where alloy already picks them up. The ring buffer holds 4095 flows/node and was measured churning at 118 flows/s — a ~35s window — so anything older is only answerable from Loki. Query it:

```logql
{container="cilium-agent"} |= "\"REQUEST\"" | json
  | line_format "{{.flow_IP_source}} -> {{.flow_destination_namespace}}/{{.flow_destination_pod_name}} {{.flow_l7_http_method}} {{.flow_l7_http_url}}"
```

`filePath: stdout` is a literal, not a path — the dynamic exporter writes a rotated file inside the container instead, which alloy cannot see (it tails `/var/log/pods`).

### Loki retention is required, not optional

Retention is off by default in this chart and the 5Gi PVC filled at ~48Mi/day. `loki.compactor.retention_enabled` + `limits_config.retention_period` are set in `monitoring/loki/values.yaml`. SingleBinary runs the compactor in-process — the top-level `compactor.replicas: 0` does **not** disable it. Validate config changes before pushing: render with `helm template` and run `loki -verify-config` against the rendered `config.yaml` in Docker.

Alloy already tails every pod's logs, `kube-system/cilium-agent` included — anything a cluster component writes to stdout lands in Loki with no alloy change.

## Known Pulumi Pitfalls

### @pulumiverse/talos provider bump triggers kubernetes cascade

When `@pulumiverse/talos` is upgraded (e.g. via Renovate), run `npm install` in `pulumi/` **before** `pulumi up`. Without it, node_modules is stale and pulumi uses the wrong plugin version.

Even after `npm install`, any `@pulumiverse/talos` version bump causes this cascade in `pulumi preview`:

```text
talosSecrets update [diff: ]          ← provider re-registers resource (values unchanged)
  → talosKubeconfig update            ← kubeconfig re-evaluated with new provider
    → kubernetesProvider replace      ← kubeconfig serialization differs between versions
      → all kubernetes resources delete + recreate
```

The deletes are real — Cilium, FluxOperator, Gateway CRDs get removed from the cluster. FluxCD reconciles them back within minutes, but there is a networking gap while Cilium restarts.

**Before deploying after a talos provider bump:** confirm you understand the cascade and have a window for brief cluster disruption. The cluster itself (Talos nodes, etcd) is unaffected.
