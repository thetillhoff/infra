# Private endpoints (tailnet-only)

Admin UIs (grafana, longhorn, hubble) and the app UIs that must not be public (trading, manga, analytics) are at `<name>.internal.thetillhoff.de`. Only the Tailscale tailnet reaches them.

## How an endpoint works

- A small Caddy reverse proxy (non-root, binds `:8443`) terminates a LetsEncrypt certificate (cert-manager DNS-01, one `Certificate` per name) and proxies to the Service of the app.
- A `Service` with `type: LoadBalancer` and `loadBalancerClass: tailscale` makes the tailscale operator join a proxy to the tailnet. The operator writes the private `100.x` address into the Service status.
- external-dns (in the `cert-manager` namespace, with the `cloudflare-api-token` of that namespace) reads the address and creates the `A` record.
- The WireGuard mesh and the tailnet ACLs are the access control. The public DNS resolves the name, but nothing routes `100.64.0.0/10`.
- All proxies share one Caddy image automation (`imageRepository`, `imagePolicy`, `imageUpdateAutomation` in this directory).
- `home.internal.thetillhoff.de` lists all endpoints. Its sidecar lists the Services of the namespace every 60 s and renders one link per `external-dns.kubernetes.io/hostname` annotation. A new endpoint appears with no extra step.

To add an endpoint, copy a `certificate`, `deployment` and `service` trio, add a `caddy-config/<name>.Caddyfile`, and add a `configMapGenerator` entry in `kustomization.yaml`. Edit the files under `caddy-config/`, never a ConfigMap manifest. Caddy does not watch its Caddyfile, and the generated ConfigMap name changes with its content, so Flux rolls the Deployment.

## Setup outside this repo (Tailscale admin console)

The manifests do nothing until the tailnet is set up:

- The OAuth client of the operator (`operator-oauth.secret.yaml`) must be allowed to create devices with the tag `tag:service`.
- The ACLs must give your user access to `tag:service` devices on port `443`. Without it the `100.x` address resolves, but connections are refused. This is the real access control.

## No HTTP/3

The proxies bind port 8443, and the Service forwards TCP/443 only. Every `caddy-config/*.Caddyfile` therefore sets `servers { protocols h1 h2 }`. The Caddyfiles are independent copies, and nothing enforces the line: copy an existing one for a new endpoint. The generic cause is in the `kubernetes` skill (`references/ingress-tls.md`).

Public ingress is TCP-only too: Envoy sends no `alt-svc`, Cilium 1.20 has no HTTP/3 setting, and only `cloud.thetillhoff.de` goes through Cloudflare (`cloudflareProxiedDnsNames` in `pulumi/index.ts`).

## Every name fails on the phone

If all `*.internal.thetillhoff.de` names fail on the phone while they work on the desktop, the Tailscale tunnel of the phone is stale. It often happens after a switch between Wi-Fi and mobile data. Turn the VPN off and on. A restart of the Tailscale app does not help.

## HSTS

Every `caddy-config/*.Caddyfile` sets `Strict-Transport-Security` with `header`. The public routes set it with a `ResponseHeaderModifier` filter on the rule of the HTTPS `HTTPRoute`; `thetillhoff.de` sends it from its own Caddy. Copy the line for a new endpoint or route.
