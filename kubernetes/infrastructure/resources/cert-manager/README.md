# cert-manager resources

## The `selfsigned-ca` must outlive the renewal of the hubble certificates

`hubble.tls.auto.method: certmanager` (in `pulumi/cilium-values.yaml`) issues the hubble certificates from the `selfsigned-ca` ClusterIssuer. cert-manager copies the CA certificate into `ca.crt` of each leaf and refreshes it only when the leaf is issued again. If the CA expires first, the trust bundle of hubble-relay expires. Then `x509: certificate has expired` follows, hubble-relay crash-loops, its Service never gets Ready, and `task deploy` fails on the Service await. The visible errors there (`resource monitor shut down`, `grpc: client connection is closing`) are misleading.

Now: CA `duration: 8760h` (`certificate-selfsigned-ca.yaml`) and leaf `certValidityDuration: 30` (30 days). The CA covers only the two hubble certificates. Everything else uses `letsencrypt-prod`.

To force a new issue (cert-manager does not renew early when `renewBefore` is longer than the life of the current certificate): delete the secret `selfsigned-ca-secret` (cert-manager), then `hubble-server-certs` and `hubble-relay-client-certs` (kube-system). Then run `rollout restart` for `daemonset/cilium` and `deployment/hubble-relay`.
