resource "helm_release" "cilium" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap
  ]
  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main
    ]
    # create_before_destroy = true # Failed last time with
    # > Unable to continue with install: Namespace "cilium-secrets" in namespace "" exists and cannot be imported into the current release: invalid ownership metadata; annotation validation error: key "meta.helm.sh/release-namespace" must equal "cilium-system": current value is "kube-system"
    # Therefore, it's recommended for now to plan a short downtime for the workloads
  }

  name      = "cilium"
  namespace = "kube-system" # default is kube-system
  # create_namespace = true

  repository = "https://helm.cilium.io"
  chart      = "cilium"
  version    = var.cilium_version

  values = [
    file("${path.module}/cilium.yaml")
  ]

  wait          = true # true is default, but we want to be explicit
  wait_for_jobs = true
}

# TODO: Add the kubectl restart command for all unmanaged pods - every time the helm release is created/changed/deleted
