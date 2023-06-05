# SSH key
resource "hcloud_ssh_key" "infra" {
  name       = "infra-key"
  public_key = file(var.kubenode_ssh_public_key_location)
}
