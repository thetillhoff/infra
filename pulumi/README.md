# pulumi

## `pulumi up` alone does not apply a change of `cilium-values.yaml`

The `cilium-config` ConfigMap changes, but the DaemonSet does not, and the agent reads most flags at start only. Always follow with:

```sh
kubectl -n kube-system rollout restart daemonset cilium
kubectl -n kube-system rollout status daemonset cilium
```

Compare the pod ages (`kubectl -n kube-system get pods -l k8s-app=cilium`) with the deploy time. Check the behaviour, not the ConfigMap.

## A change of the Talos host DNS needs a CoreDNS restart

CoreDNS forwards to the nameservers in its `/etc/resolv.conf`, which the kubelet writes when the pod starts. After a change of `machine.features.hostDNS` in the Talos patch (for example `forwardKubeDNSToHost`), the running CoreDNS pods keep the old nameserver, and every lookup of an external name fails. Restart CoreDNS right after the deploy:

```sh
kubectl -n kube-system rollout restart deployment coredns
```

## Network encryption

Talos KubeSpan is the one encryption layer between the nodes. It routes all traffic between node IPs through WireGuard (`forceRouting`): when a peer is down, the traffic is dropped, not sent in clear. Cilium WireGuard is off, because it would only encrypt the pod traffic a second time, and Cilium never encrypts host traffic of control-plane nodes.

| Traffic | Encryption |
| --- | --- |
| Internet to the gateway | TLS from cert-manager (Let's Encrypt). Port 80 only redirects. `cloud.` goes through Cloudflare, which checks the origin certificate (`ssl: strict`). |
| Gateway (Envoy, host network) to a pod on another node | KubeSpan |
| Pod to pod on different nodes | VXLAN between the node IPs, so KubeSpan |
| Node to node (etcd, kubelet, API server, Longhorn replicas) | KubeSpan, plus mTLS of etcd and the kubelet |
| Pod to pod on the same node | None: the traffic does not leave the node. |
| Tailnet to a private endpoint | Tailscale WireGuard, then TLS of the Caddy proxy |
| Pods to the internet | The TLS of each app |

KubeSpan has an MTU of 1420, and VXLAN takes 50 bytes of it. Check the peers with `talosctl get kubespanpeerstatuses`: each one must be `up`.

## Cloudflare

`cloudflareProxiedDnsNames` in `index.ts` lists the hostnames that go through the Cloudflare edge. The `ssl-mode` zone setting (`cloudflare.ZoneSetting`) is pinned to `strict`. Cert-manager already issues a certificate for each Gateway listener, so a proxied hostname needs no extra step. The stack secret `cloudflare:apiToken` needs `Zone > Zone Settings > Edit` and its DNS scope. The cause of the redirect loop with `flexible` is in the `kubernetes` skill (`references/ingress-tls.md`).

## A `@pulumiverse/talos` version bump deletes and recreates all Kubernetes resources

Run `npm install` before `pulumi up`. Without it, `node_modules` is old and Pulumi uses the wrong plugin version. Every version bump of the provider then shows this chain in `pulumi preview`:

```text
talosSecrets update [diff: ]          <- provider registers the resource again (values unchanged)
  -> talosKubeconfig update           <- kubeconfig is evaluated again with the new provider
    -> kubernetesProvider replace     <- kubeconfig serialization differs between versions
      -> all kubernetes resources delete + recreate
```

The deletes are real: Cilium, the Flux operator and the Gateway CRDs are removed. Flux creates them again within minutes, and the network has a gap while Cilium restarts. The Talos nodes and etcd are not affected. Plan a window for a short disruption before the deploy.
