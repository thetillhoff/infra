data "hcloud_image" "packer_snapshot" {
  with_architecture = var.architecture
  most_recent       = true
  id                = var.image_id
}

resource "hcloud_server" "nodes" {

  for_each = { for node in local.nodes : node.name => node }

  name        = each.key
  server_type = var.server_type
  image       = data.hcloud_image.packer_snapshot.id
  location    = var.location

  # User data is optional, since config-apply does the same
  # user_data   = data.talos_machine_configuration.main.machine_configuration

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  shutdown_before_deletion = true # graceful shutdown on deletion

  # lifecycle {
  #   ignore_changes = [
  #     # User data is only applied once. If a major change is needed, use a separate nodegroup instead
  #     user_data
  #   ]
  # }
}

# resource "hcloud_server_network" "srvnetwork" {
#   for_each   = { for node in local.nodes : node.name => node }
#   server_id  = hcloud_server.nodes[each.key].id
#   network_id = var.network_id
#   ip         = cidrhost(var.subnet_cidr, each.value.index)
# }

resource "time_sleep" "wait_for_vm_creation" {
  depends_on = [hcloud_server.nodes]

  lifecycle {
    replace_triggered_by = [
      hcloud_server.nodes
    ]
  }

  create_duration = "10s"
}
