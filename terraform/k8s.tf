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
    "talos-v1-10-2-controlplane" = {
      location           = "nbg1"
      architecture       = "amd64"
      server_type        = "cx22"
      talos_image_id     = "238440759" # Retrieve from packer snapshot
      talos_machine_type = "controlplane"
      count              = 3
    }
  }

  retrieve_talosconfig_from_nodegroup = "talos-v1-10-2-controlplane"

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
