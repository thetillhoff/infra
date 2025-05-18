
variable "talos_client_configuration" {
  type      = any
  sensitive = true
}

variable "bootstrap_node" {
  description = "Can be any node, as the actual value is ignored via lifecycle configuration"
  type        = string
}

variable "cilium_version" {
  type = string
}

variable "flux_version" {
  type = string
}

variable "flux_system_agekey" {
  type      = string
  sensitive = true
}

variable "GITHUB_TOKEN" {
  type      = string
  sensitive = true
}
