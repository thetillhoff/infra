# SSH key
resource "hcloud_ssh_key" "kubenode" {
  provider = hcloud.hcloud-pegasus

  name       = "kubenode"
  public_key = file(var.kubenode_ssh_public_key_location)

  lifecycle {
    ignore_changes = [
      public_key,
    ]
  }
}
