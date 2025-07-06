variable "CLOUDFLARE_APITOKEN" {
  type      = string
  sensitive = true
}

#####

variable "cloudflare_zone_id" {
  type = string
}

variable "create_local_config_files" {
  type    = bool
  default = false # Retrieve from output instead - see ./k8s/README.md
}
