resource "helm_release" "cilium" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap
  ]
  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_bootstrap.main.id,
      time_sleep.wait_for_dns
    ]
  }
  name       = "cilium"
  namespace  = "kube-system"
  repository = "https://helm.cilium.io"
  chart      = "cilium"
  version    = "1.17.2"
  values = [
    file("${path.module}/cilium.yaml")
  ]
}
