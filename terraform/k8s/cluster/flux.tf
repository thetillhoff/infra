resource "kubernetes_namespace" "flux_system" {
  depends_on = [
    helm_release.cilium,
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main
    ]
    ignore_changes = [metadata[0].labels] # Otherwise every deployment causes a change
  }
  metadata {
    name = "flux-system"
  }
}

resource "kubernetes_secret" "sops_age" {
  depends_on = [
    kubernetes_namespace.flux_system
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main
    ]
  }
  metadata {
    namespace = kubernetes_namespace.flux_system.metadata[0].name
    name      = "sops-age"
  }

  data = {
    # The `.agekey` suffix is required to specify an age private key for flux
    "age.agekey" = var.flux_system_agekey
  }
}

resource "flux_bootstrap_git" "hydra" {
  depends_on = [
    kubernetes_secret.sops_age
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main
    ]
  }

  namespace = kubernetes_namespace.flux_system.metadata[0].name

  version = var.flux_version

  path                 = "kubernetes/clusters/hydra"
  delete_git_manifests = false # Most probably related to destruction of this resource: Should it remove the cluster config from the git repo or not?
  components_extra     = ["image-reflector-controller", "image-automation-controller"]

  timeouts = {
    create = "10m"
  }
}
