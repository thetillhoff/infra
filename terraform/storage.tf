# Create storage
resource "hcloud_volume" "kubenode_storage" {
  provider = hcloud.hcloud-pegasus

  name     = "kubenode"
  size     = 10
  location = var.location
  format   = "ext4"
}

resource "hcloud_volume_attachment" "kubenode_storagemount" {
  provider = hcloud.hcloud-pegasus

  volume_id = hcloud_volume.kubenode_storage.id
  server_id = hcloud_server.kubenode.id
  automount = true
}
