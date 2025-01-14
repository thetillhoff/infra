variable "HCLOUD_TOKEN" {
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

variable "create_local_config_files" {
  type    = bool
  default = false
}

#####

variable "cloudflare_zone_id" {
  type = string
}
variable "location" {
  type = string
}

variable "node_count" {
  type = number
}
