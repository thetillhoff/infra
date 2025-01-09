resource "helm_release" "cilium" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main.id
    ]
  }
  name       = "cilium"
  namespace  = "kube-system"
  repository = "https://helm.cilium.io"
  chart      = "cilium"
  version    = "1.16.4"
  values = [
    file("${path.module}/cilium.yaml")
  ]
}
