# Create volume
resource "hcloud_volume" "kubenode_volume" {
  service_id = hcloud_server.kubenode.id

  name = "vol-${hcloud_server.kubenode.name}"
  size = var.storagesize

  automount = true
}
