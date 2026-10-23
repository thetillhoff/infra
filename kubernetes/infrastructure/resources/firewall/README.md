# Firewall

The `CiliumClusterwideNetworkPolicy` uses `nodeSelector: {}`. It is a node (host) firewall, not a pod-to-pod policy. No pod-level default-deny exists, so traffic between namespaces is not restricted.

The policy does nothing today. Host policy needs `hostFirewall.enabled` in `pulumi/cilium-values.yaml`, and that is unset (`kubectl -n kube-system get cm cilium-config -o jsonpath='{.data.enable-host-firewall}'` prints `false`).

Before you turn it on: the `toPorts` entries have no `protocol:`, and Cilium defaults to TCP. UDP/443 (QUIC) would then be dropped.
