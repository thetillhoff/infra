variable "SSH_PUBLIC_KEY" {
  sensitive = true
}
variable "SSH_PRIVATE_KEY" {
  sensitive = true
}

variable "HCLOUD_TOKEN" {
  sensitive = true
}

#####

variable "cluster-name" {}
variable "location" {}
variable "nodetype" {}
variable "ssh_key_id" {}
