variable "nodegroup_name" {
  type = string
}

variable "node_count" {
  type = number
}

variable "image_id" {
  type = string
}

variable "architecture" {
  type = string
  # x86 or arm
}

variable "server_type" {
  type = string
  # cx22
}

variable "location" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "machine_secrets" {
  type = object({
    certs = object({
      etcd = object({
        cert = string
        key  = string
      })
      k8s = object({
        cert = string
        key  = string
      })
      k8s_aggregator = object({
        cert = string
        key  = string
      })
      k8s_serviceaccount = object({
        key = string
      })
      os = object({
        cert = string
        key  = string
      })
    })
    cluster = object({
      id     = string
      secret = string
    })
    secrets = object({
      aescbc_encryption_secret    = string
      bootstrap_token             = string
      secretbox_encryption_secret = string
    })
    trustdinfo = object({
      token = string
    })
  })
  sensitive = true
}

variable "client_configuration" {
  type      = any
  sensitive = true
}

variable "cluster_name" {
  type = string
}

variable "cluster_endpoint" {
  type = string
}

variable "talos_machine_type" {
  type = string
  # controlplane or worker
}

variable "config_patches" {
  type = list(string)
}

variable "kubernetes_version" {
  type = string
}

variable "network_id" {
  type = string
}
