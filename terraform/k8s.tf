module "k8s" {
  source = "./k8s"

  providers = {
    hcloud     = hcloud.hcloud-hydra
    cloudflare = cloudflare
    talos      = talos
  }

  cluster_name     = "hydra"
  cluster_endpoint = "https://hydra.k8s.thetillhoff.de:6443"
  network_cidr     = "10.0.0.0/8"
  subnet_cidr      = "10.1.0.0/16"

  nodegroups = {
    "talos-v1-10-3-controlplane" = {
      count = 2

      # amd64
      # talos_image_id     = "241003589" # amd64 v1.10.3 # Retrieved from packer snapshot id
      # architecture       = "amd64" # amd64 or arm64
      # server_type        = "cpx31" # cx32 (intel) or cpx31 (amd) for amd64 or cax21 for arm64

      # arm64
      talos_image_id = "241090908" # arm64 v1.10.3 # Retrieved from packer snapshot id
      architecture   = "arm64"     # amd64 or arm64
      server_type    = "cax21"     # cx32 (intel) or cpx31 (amd) for amd64 or cax21 for arm64

      talos_machine_type = "controlplane"
      location           = "nbg1"
      kubernetes_version = "1.33.1"
    }
  }

  retrieve_talosconfig_from_nodegroup = "talos-v1-10-3-controlplane"

  cloudflare_zone_id = var.cloudflare_zone_id

  GITHUB_TOKEN = var.GITHUB_TOKEN

  flux_system_agekey = var.AGE_KEY

  create_local_config_files = var.create_local_config_files
}

output "talosconfig" {
  value     = module.k8s.talosconfig
  sensitive = true
}

output "kubeconfig" {
  value     = module.k8s.kubeconfig
  sensitive = true
}
