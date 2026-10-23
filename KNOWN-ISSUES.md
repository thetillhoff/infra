# Known issues

- Tailscale proxy pods run `privileged` (8 service proxies and 2 exit-node pods in `tailscale`). The operator needs `/dev/net/tun` and sets `net.ipv4.ip_forward` in a privileged init container. The only documented alternative is a third-party device plugin (squat `generic-device-plugin`), which runs privileged itself, so it removes no privilege from the node. Accepted on 2026-10-23. Reopen it when the operator supports unprivileged kernel proxies.
