# Create volume
resource "hcloud_volume" "kubenode" {
  server_id = hcloud_server.kubenode.id

  name = "vol-${hcloud_server.kubenode.name}"
  size = var.storagesize
}
