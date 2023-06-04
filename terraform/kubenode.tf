# Create server
resource "hcloud_server" "kubenode" {
  name        = var.kubenode_name
  server_type = "cx21"
  image       = "debian-11"
  location    = var.location
  user_data   = file("cloud-init.yaml")
  ssh_keys    = [hcloud_ssh_key.infra.id]

  connection {
    private_key = file("kubenode_ssh_private.key")
    host        = self.ipv4_address
  }

  provisioner "remote-exec" {
    inline = ["cloud-init status --wait"]
  }
}