variable "HCLOUD_TOKEN" {
  type      = string
  sensitive = true
}

variable "HCLOUD_TOKEN_HYDRA" {
  type      = string
  sensitive = true
}

variable "CLOUDFLARE_APITOKEN" {
  type      = string
  sensitive = true
}

variable "GITHUB_TOKEN" {
  type      = string
  sensitive = true
}

#####

variable "cloudflare_zone_id" {
  type = string
}
variable "kubenode_name" {
  type = string
}
variable "location" {
  type = string
}
variable "kubenode_ssh_private_key_location" {
  type = string
}
variable "kubenode_ssh_public_key_location" {
  type = string
}
