# Firewall

`hostFirewall.enabled` (`pulumi/cilium-values.yaml`) lets Cilium enforce `ciliumClusterwideNetworkPolicy.yaml` on the nodes. The policy opens only 80/tcp, 443/tcp, 6443 (Kubernetes API) and 50000 (Talos API) to the internet. Client certificates protect the two API ports. etcd, the kubelet, Talos trustd (50001) and the Cilium ports are for the cluster only. From the internet, only the ICMP types for path MTU discovery, traceroute and ping pass.

Cilium runs IPv4 only, so this policy does not filter IPv6, and etcd, the kubelet and trustd also listen on the IPv6 address of each node. The Hetzner firewall `<cluster>-nodes` (`pulumi/index.ts`) is the outer layer for both families: the same public ports, all ICMP, and all traffic between the node IPs.

The policy has no egress rule on purpose: it would add risk and no protection. Pod to pod traffic is not covered here: see the `default-deny-ingress` policies of the namespaces.

Check the result from outside, over IPv4 and IPv6: connect to ports 2379, 2380, 10250, 50001, 4240, 9100 and 9962 of a node IP. They must time out. 6443 and 50000 must answer over both families, 80 and 443 over IPv4 (the gateway binds IPv4 only).

## Change the policy

A wrong rule locks out the Talos API and `kubectl`. The recovery is the Hetzner console. Test a change in audit mode first:

1. Find the host endpoint of each node: `kubectl -n kube-system exec <cilium-pod> -c cilium-agent -- cilium-dbg endpoint list -o json`, the entry with the label `reserved:host`.
2. Set `cilium-dbg endpoint config <id> PolicyAuditMode=Enabled` in the agent pod of each node, then push the change.
3. Collect `hubble observe --verdict AUDIT --follow` on every node for 10 minutes. Each flow is one the new policy would drop.
4. Set `PolicyAuditMode=Disabled`, one node at a time. After each node check the ports from outside, `kubectl get nodes`, `talosctl version` and an app URL.

The audit mode is lost when an agent pod restarts, and the default is enforcement.
