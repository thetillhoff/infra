resource "tls_private_key" "flux" {
  algorithm = "ED25519"
}

resource "github_repository_deploy_key" "flux" {
  title      = "Flux"
  repository = "infra"
  key        = tls_private_key.flux.public_key_openssh
  read_only  = "false"
}

resource "flux_bootstrap_git" "hydra" {
  depends_on = [
    time_sleep.wait_60_seconds_for_talos_bootstrap,
    talos_cluster_kubeconfig.kubeconfig,
    helm_release.cilium
  ]

  path                 = "kubernetes/clusters/hydra"
  delete_git_manifests = false
  # components = ["source-controller", "kustomize-controller", "helm-controller", "notification-controller"]
  components_extra = ["image-reflector-controller", "image-automation-controller"]
  # disable_secret_creation = true

  timeouts = {
    create = "5m"
  }
}
