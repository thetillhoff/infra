# SSH key
resource "hcloud_ssh_key" "kubenode" {
  name       = "kubenode"
  public_key = file(var.kubenode_ssh_public_key_location)
}
