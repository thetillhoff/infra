data "tls_public_key" "infra" {
  private_key_openssh = file("kubenode_ssh_private.key")
}

# SSH public key
resource "hcloud_ssh_key" "infra" {
  name       = "infra-key"
  public_key = data.tls_public_key.infra
}
