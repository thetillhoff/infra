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

variable "name" {}
variable "location" {}
# masters don't have attached storage (only their root disk)
variable "master" {type = bool}
variable "storagesize" {
  type = number
  default = 0
}
