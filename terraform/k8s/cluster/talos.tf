# Bootstrap one of the kubenodes
resource "talos_machine_bootstrap" "main" {
  node                 = var.bootstrap_node
  client_configuration = var.talos_client_configuration

  lifecycle {
    ignore_changes = [
      node,
      client_configuration
    ]
  }
}

resource "time_sleep" "wait_for_talos_bootstrap" {
  depends_on = [
    talos_machine_bootstrap.main
  ]

  create_duration = "30s"
}

resource "talos_cluster_kubeconfig" "kubeconfig" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap,
  ]

  lifecycle {
    replace_triggered_by = [
      talos_machine_bootstrap.main
    ]
  }

  client_configuration = var.talos_client_configuration
  node                 = var.bootstrap_node
}
