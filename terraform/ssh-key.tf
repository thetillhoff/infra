# SSH key
resource "hcloud_ssh_key" "infra" {
  name       = "infra-key"
  public_key = var.KUBENODE_SSH_PUBLIC_KEY
}
