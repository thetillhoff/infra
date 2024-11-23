# Create server
resource "hcloud_server" "kubenode" {
  provider = hcloud.hcloud-pegasus

  name        = var.kubenode_name
  server_type = "cx21"
  image       = "debian-11"
  location    = var.location
  user_data   = file("cloud-init.yaml")
  ssh_keys    = [hcloud_ssh_key.kubenode.id]

  connection {
    private_key = file(var.kubenode_ssh_private_key_location)
    host        = self.ipv4_address
  }

  provisioner "remote-exec" {
    inline = ["cloud-init status --wait"]
  }
}
