output "nodes" {
  value = {
    for name, node in hcloud_server.nodes : name => node
  }
}

output "talosconfig" {
  value = data.talos_client_configuration.main.talos_config
}
