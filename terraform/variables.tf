variable "KUBENODE_SSH_PRIVATE_KEY" {
  sensitive = true
}

variable "HCLOUD_TOKEN" {
  sensitive = true
}

variable "CLOUDFLARE_APITOKEN" {
  sensitive = true
}

variable "GITHUB_TOKEN" {
  sensitive = true
}



#####

variable "kubenode_name" {}
variable "location" {}
