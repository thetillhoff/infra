resource "flux_bootstrap_git" "hydra" {
  depends_on = [
    time_sleep.wait_for_dns,
    time_sleep.wait_for_talos_bootstrap,
    talos_cluster_kubeconfig.kubeconfig,
    helm_release.cilium
  ]
  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_bootstrap.main.id
    ]
  }

  path                 = "kubernetes/clusters/hydra"
  delete_git_manifests = false
  components_extra     = ["image-reflector-controller", "image-automation-controller"]

  timeouts = {
    create = "10m"
  }
}

resource "kubernetes_secret" "flux_system" {
  depends_on = [
    flux_bootstrap_git.hydra
  ]
  metadata {
    namespace = "flux-system"
    name      = "sops-age"
  }
  data = {
    "sops.asc" = var.flux_system_agekey
  }
}
