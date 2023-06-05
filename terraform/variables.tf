variable "HCLOUD_TOKEN" {
  sensitive = true
}

variable "CLOUDFLARE_APITOKEN" {
  sensitive = true
}


#####

variable "kubenode_name" {}
variable "location" {}
variable "kubenode_ssh_private_key_location" {}
variable "kubenode_ssh_public_key_location" {}
