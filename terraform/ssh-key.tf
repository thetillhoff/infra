# SSH public key
resource "hcloud_ssh_key" "infra" {
  name       = "infra-key"
  public_key = var.SSH_PUBLIC_KEY
}
