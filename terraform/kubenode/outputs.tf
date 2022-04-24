output "public_ipv4_address" {
  value = hcloud_server.kubenode.ipv4_address
}

output "private_ipv4_address" {
  value = hcloud_server_network.kubenode.ip
}
