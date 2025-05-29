variable "cluster_name" {
  type = string
}

variable "cluster_endpoint" {
  type = string
}

variable "network_cidr" {
  type = string
}

variable "subnet_cidr" {
  type = string
}

variable "nodegroups" {
  type = map(object({
    count              = number
    talos_image_id     = string # Must match architecture
    talos_machine_type = string
    architecture       = string # Must match image_id
    server_type        = string
    location           = string
    kubernetes_version = string
  }))
}

variable "cloudflare_zone_id" {
  type = string
}

variable "GITHUB_TOKEN" {
  type      = string
  sensitive = true
}

variable "flux_system_agekey" {
  type      = string
  sensitive = true
}

# ---

variable "retrieve_talosconfig_from_nodegroup" {
  type = string
}

variable "create_local_config_files" {
  type    = bool
  default = false
}
