output "nodes" {
  value = hcloud_server.nodes
}

output "talosconfig" {
  value = data.talos_client_configuration.main.talos_config
}
