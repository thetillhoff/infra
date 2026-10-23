# Firewall

`hostFirewall.enabled` (`pulumi/cilium-values.yaml`) lets Cilium enforce a `CiliumClusterwideNetworkPolicy` with `nodeSelector` on the nodes. `ciliumClusterwideNetworkPolicy.yaml` opens only 80/tcp, 443/tcp and udp, 6443 (Kubernetes API) and 50000 (Talos API) to the internet. The API ports are protected by client certificates. etcd, the kubelet and the other node ports are for the cluster only. No egress rule exists on purpose: it would add risk and no protection.

The policy is not in `kustomization.yaml` while the roll-out is open (see below). Pod to pod traffic is not covered here: see the `default-deny-ingress` policies of the namespaces.

## Roll-out

A wrong rule locks out the Talos API and `kubectl`. The recovery is the Hetzner console. Enforce the policy only after the audit run shows nothing unexpected.

1. Deploy the Cilium value with `task deploy`. Without a policy the host endpoints stay open.
2. Put each host endpoint in audit mode: `kubectl -n kube-system exec ds/cilium -c cilium-agent -- cilium-dbg endpoint list` shows the endpoint with the label `reserved:host`; then run `cilium-dbg endpoint config <id> PolicyAuditMode=Enabled` in the agent pod of each node.
3. Add `ciliumClusterwideNetworkPolicy.yaml` to `kustomization.yaml` and push.
4. Watch `hubble observe --verdict AUDIT` for 10 minutes. Every flow from `world` to a port that is not in the policy would be dropped.
5. Switch the audit mode off on each node (`PolicyAuditMode=Disabled`), one node at a time. Check `kubectl get nodes`, an app URL and `talosctl version` after each node.

An audit mode setting is lost when the agent pod restarts. Set it again before you change the policy.
