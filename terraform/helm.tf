resource "helm_release" "cilium" {
  depends_on = [
    time_sleep.wait_60_seconds_for_talos_bootstrap,
    local_sensitive_file.kubeconfig
  ]
  name       = "cilium"
  namespace  = "kube-system"
  repository = "https://helm.cilium.io"
  chart      = "cilium"
  version    = "1.16.4"
  values = [
    file("${path.module}/cilium.yaml")
  ]
}
