# Create volume
resource "hcloud_volume" "kubenode_volume" {
  location = var.location

  name = "vol-${hcloud_server.kubenode.id}"
  size = var.storagesize
}

# Attach volume to server
resource "hcloud_volume_attachment" "kubenode_volume" {
  volume_id = hcloud_volume.kubenode_volume.id
  server_id = hcloud_server.kubenode.id
  automount = true
}
