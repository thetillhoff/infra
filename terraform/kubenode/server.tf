# Create server
resource "hcloud_server" "kubenode" {
  name = "${var.cluster-name}-${var.index}"
  server_type = "${var.nodetype}"
  image = "debian-11"
  location = var.location
  user_data = file("kubenode/cloud-init.yaml")
  ssh_keys = ["${var.ssh_key_id}"]

  connection {
    private_key = var.SSH_PRIVATE_KEY
    host = "${self.ipv4_address}"
  }

  provisioner "remote-exec" {
    inline = [ "cloud-init status --wait" ]
  }
}
