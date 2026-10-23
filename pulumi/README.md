# pulumi

## `pulumi up` alone does not apply a change of `cilium-values.yaml`

The `cilium-config` ConfigMap changes, but the DaemonSet does not, and the agent reads most flags at start only. Always follow with:

```sh
kubectl -n kube-system rollout restart daemonset cilium
kubectl -n kube-system rollout status daemonset cilium
```

Compare the pod ages (`kubectl -n kube-system get pods -l k8s-app=cilium`) with the deploy time. Check the behaviour, not the ConfigMap.

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
