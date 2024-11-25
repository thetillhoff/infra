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
  config_patches   = [file("${path.module}/../talos/controlplane-patch.yaml")]
}

# data "talos_client_configuration" "talosconfig" {
#   cluster_name         = local.talos_cluster_name
#   client_configuration = talos_machine_secrets.main.client_configuration
#   endpoints = [
#     "https://hydra.k8s.thetillhoff.de:6443"
#   ]
#   nodes = [
#     for node in hcloud_server.kubenodes : node.ipv4_address
#   ]
# }

# Apply the machine configuration to all kubenodes
resource "talos_machine_configuration_apply" "main" {
  count                       = length(hcloud_server.kubenodes)
  client_configuration        = talos_machine_secrets.main.client_configuration
  machine_configuration_input = data.talos_machine_configuration.controlplane.machine_configuration
  node                        = hcloud_server.kubenodes[count.index].ipv4_address
  endpoint                    = hcloud_server.kubenodes[count.index].ipv4_address
  config_patches              = [file("${path.module}/../talos/controlplane-patch.yaml")]
  timeouts = {
    create = "1m"
  }
}

resource "time_sleep" "wait_60_seconds_for_dns" {
  depends_on = [
    talos_machine_configuration_apply.main,
    cloudflare_record.k8s-hydra
  ]

  create_duration = "60s"
}

# Bootstrap one of the kubenodes
resource "talos_machine_bootstrap" "main" {
  depends_on = [
    talos_machine_configuration_apply.main,
    time_sleep.wait_60_seconds_for_dns
  ]
  node                 = hcloud_server.kubenodes[0].ipv4_address
  endpoint             = hcloud_server.kubenodes[0].ipv4_address
  client_configuration = talos_machine_secrets.main.client_configuration
}

resource "time_sleep" "wait_60_seconds_for_talos_bootstrap" {
  depends_on = [
    talos_machine_bootstrap.main
  ]

  create_duration = "60s"
}

resource "talos_cluster_kubeconfig" "kubeconfig" {
  depends_on = [
    time_sleep.wait_60_seconds_for_talos_bootstrap
  ]
  client_configuration = talos_machine_secrets.main.client_configuration
  node                 = hcloud_server.kubenodes[0].ipv4_address
}
