data "talos_machine_configuration" "main" {
  cluster_name     = var.cluster_name
  machine_type     = var.talos_machine_type
  cluster_endpoint = var.cluster_endpoint
  machine_secrets  = var.machine_secrets
  # Changing kubernetes_version might trigger changes to nodes, since it's provided as user_data
  # kubernetes_version = var.kubernetes_version # f.e. 1.25.4
  examples       = false
  docs           = false
  config_patches = var.config_patches
}

data "talos_client_configuration" "main" {
  cluster_name         = var.cluster_name
  client_configuration = var.client_configuration
  nodes = flatten([
    for node in values(hcloud_server.nodes) : node.ipv4_address
  ])
  endpoints = flatten([
    for node in values(hcloud_server.nodes) : node.ipv4_address
  ])
}

# Apply the machine configuration to all kubenodes
resource "talos_machine_configuration_apply" "main" {
  depends_on = [time_sleep.wait_for_vm_creation]
  for_each   = hcloud_server.nodes

  client_configuration        = data.talos_client_configuration.main.client_configuration
  machine_configuration_input = data.talos_machine_configuration.main.machine_configuration
  node                        = each.value.ipv4_address # name of the node
  config_patches              = var.config_patches
  timeouts = {
    create = "1m"
  }
}

resource "time_sleep" "wait_for_talos_config_apply" {
  depends_on      = [talos_machine_configuration_apply.main]
  create_duration = "5s"

  lifecycle {
    replace_triggered_by = [
      hcloud_server.nodes,
      talos_machine_configuration_apply.main
    ]
  }
}
