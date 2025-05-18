output "machine_secrets" {
  value     = talos_machine_secrets.main.machine_secrets
  sensitive = true
}

output "client_configuration" {
  value     = talos_machine_secrets.main.client_configuration
  sensitive = true
}

output "network_id" {
  value = hcloud_network.cluster_network.id
}
