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

variable "CLUSTER_NAME" {}
variable "location" {}
