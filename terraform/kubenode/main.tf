# SSH public key
resource "hcloud_ssh_key" "infra" {
  name       = "infra-key"
  public_key = var.SSH_PUBLIC_KEY
}

# Create server
resource "hcloud_server" "kubenode" {
  name = var.name
  server_type = "cx21"
  image = "debian-11"
  location = var.location
  user_data = file("kubenode/cloud-init.yaml")
  ssh_keys = ["${hcloud_ssh_key.infra.id}"]

  connection {
    private_key = var.SSH_PRIVATE_KEY
    host = "${self.ipv4_address}"
  }

  provisioner "remote-exec" {
    inline = [ "cloud-init status --wait" ]
  }
}

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
