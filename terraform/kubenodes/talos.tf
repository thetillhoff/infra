locals {
  talos_cluster_name = "hydra"
}

resource "talos_machine_secrets" "main" {}

data "talos_machine_configuration" "controlplane" {
  cluster_name     = local.talos_cluster_name
  machine_type     = "controlplane"
  cluster_endpoint = "https://hydra.k8s.thetillhoff.de:6443"
  machine_secrets  = talos_machine_secrets.main.machine_secrets
  examples         = false
  docs             = false
  config_patches   = [file("../talos/controlplane-patch.yaml")]
}

# Apply the machine configuration to all kubenodes
resource "talos_machine_configuration_apply" "main" {
  depends_on = [time_sleep.wait_for_vm_creation]
  count      = length(hcloud_server.kubenodes)

  client_configuration        = talos_machine_secrets.main.client_configuration
  machine_configuration_input = data.talos_machine_configuration.controlplane.machine_configuration
  node                        = hcloud_server.kubenodes[count.index].ipv4_address # name of the node
  config_patches              = [file("../talos/controlplane-patch.yaml")]
  timeouts = {
    create = "1m"
  }
}

resource "time_sleep" "wait_for_talos_config_apply" {
  depends_on      = [talos_machine_configuration_apply.main]
  create_duration = "5s"

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_configuration_apply.main
    ]
  }
}

# Bootstrap one of the kubenodes
resource "talos_machine_bootstrap" "main" {
  depends_on = [
    talos_machine_configuration_apply.main,
    time_sleep.wait_for_talos_config_apply
  ]
  node                 = hcloud_server.kubenodes[0].ipv4_address # name of the node
  client_configuration = talos_machine_secrets.main.client_configuration

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_configuration_apply.main
    ]
  }
}

resource "time_sleep" "wait_for_talos_bootstrap" {
  depends_on = [
    talos_machine_bootstrap.main
  ]

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_configuration_apply.main
    ]
  }

  create_duration = "5s"
}

resource "talos_cluster_kubeconfig" "kubeconfig" {
  depends_on = [
    time_sleep.wait_for_talos_bootstrap,
    time_sleep.wait_for_dns
  ]

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_machine_bootstrap.main
    ]
  }

  client_configuration = talos_machine_secrets.main.client_configuration
  node                 = hcloud_server.kubenodes[0].ipv4_address
}

resource "local_sensitive_file" "kubeconfig" {
  count = var.create_local_config_files ? 1 : 0

  content  = talos_cluster_kubeconfig.kubeconfig.kubeconfig_raw
  filename = "${path.module}/kubeconfig"

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes,
      talos_cluster_kubeconfig.kubeconfig
    ]
  }
}
