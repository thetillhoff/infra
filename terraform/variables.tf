variable "SSH_PUBLIC_KEY" {
  sensitive = true
}
variable "SSH_PRIVATE_KEY" {
  sensitive = true
}

variable "HCLOUD_TOKEN" {
  sensitive = true
}

variable "CLOUDFLARE_EMAIL" {
  sensitive = true
}
variable "CLOUDFLARE_APIKEY" {
  sensitive = true
}

#####

variable "ROOT_DOMAIN" {}
variable "CLUSTER_NAME" {}
variable "kubenode_master_instances" {type = number}
variable "storagesize" {type = number}
variable "location" {}
