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
variable "index" {}
variable "location" {}
variable "nodetype" {}
variable "storagesize" {
  type = number
  default = 0
}
variable "network_id" {}
variable "ssh_key_id" {}
variable "load_balancer_id" {}
