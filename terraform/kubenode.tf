# Create server
resource "hcloud_server" "kubenode" {
  name = "${var.CLUSTER_NAME}"
  server_type = "cx21"
  image = "debian-11"
  location = var.location
  user_data = file("kubenode/cloud-init.yaml")
  ssh_keys = [hcloud_ssh_key.infra.id]

  connection {
    private_key = var.SSH_PRIVATE_KEY
    host = self.ipv4_address
  }

  provisioner "remote-exec" {
    inline = [ "cloud-init status --wait" ]
  }
}