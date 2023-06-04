# Create deploy key
resource "tls_private_key" "deploy_key" {
  algorithm = "ED25519"
}

# Add a deploy key to github repo
resource "github_repository_deploy_key" "infra_deploy_key" {
  title      = "Deploy key for FluxCD"
  repository = "infra"
  key        = tls_private_key.deploy_key.public_key_openssh
  read_only  = "false"
}

resource "local_sensitive_file" "deploy_key_for_flux" {
  content  = tls_private_key.deploy_key.private_key_openssh
  filename = "../deploy.key"
}
