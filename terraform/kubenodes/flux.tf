resource "flux_bootstrap_git" "hydra" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap,
    talos_cluster_kubeconfig.kubeconfig,
    helm_release.cilium
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main.id
    ]
  }

  path                 = "kubernetes/clusters/hydra"
  delete_git_manifests = false
  # components = ["source-controller", "kustomize-controller", "helm-controller", "notification-controller"]
  components_extra = ["image-reflector-controller", "image-automation-controller"]
  # disable_secret_creation = true

  timeouts = {
    create = "5m"
  }
}
