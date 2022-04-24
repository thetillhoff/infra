resource "hcloud_server_network" "kubenode" {
  server_id = hcloud_server.kubenode.id
  network_id = var.network_id
}
