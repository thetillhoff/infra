module "config" {
  source = "./config"

  providers = {
    hcloud = hcloud
    talos  = talos
  }

  cluster_name = var.cluster_name
  network_cidr = var.network_cidr
  subnet_cidr  = var.subnet_cidr
}

module "nodegroup" {
  source = "./nodegroup"

  providers = {
    hcloud     = hcloud
    cloudflare = cloudflare
    talos      = talos
  }

  for_each = var.nodegroups

  cluster_name     = var.cluster_name
  cluster_endpoint = var.cluster_endpoint

  nodegroup_name       = each.key
  node_count           = each.value.count
  image_id             = each.value.talos_image_id
  architecture         = each.value.architecture
  server_type          = each.value.server_type
  location             = each.value.location
  machine_secrets      = module.config.machine_secrets
  client_configuration = module.config.client_configuration
  talos_machine_type   = each.value.talos_machine_type
  config_patches = [
    file("${path.module}/nodegroup-patches/${each.key}-patch.yaml")
  ] # Conscious choice to not use `fileexists` here, so it cannot be forgotten during upgrades
  # config_patches       = module.config.config_patches
  network_id         = module.config.network_id
  cloudflare_zone_id = var.cloudflare_zone_id
}

module "cluster" {
  source = "./cluster"

  providers = {
    talos = talos
  }

  bootstrap_node = flatten([
    for ng in values(module.nodegroup) : [
      for node in values(ng.nodes) : {
        ipv4_address = node.ipv4_address
      }
    ]
  ])[0].ipv4_address

  talos_client_configuration = module.config.client_configuration

  cilium_version = "1.17.4" # From https://github.com/cilium/cilium

  flux_version = "v2.5.1" # From https://github.com/fluxcd/flux2

  flux_system_agekey = var.flux_system_agekey

  GITHUB_TOKEN = var.GITHUB_TOKEN
}

output "talosconfig" {
  value = module.nodegroup[var.retrieve_talosconfig_from_nodegroup].talosconfig
}

output "kubeconfig" {
  value = module.cluster.kubeconfig
}

resource "local_file" "talosconfig" {
  count = var.create_local_config_files ? 1 : 0

  content  = module.nodegroup[var.retrieve_talosconfig_from_nodegroup].talosconfig
  filename = "${path.module}/talosconfig"
}

resource "local_file" "kubeconfig" {
  count = var.create_local_config_files ? 1 : 0

  content  = module.cluster.kubeconfig
  filename = "${path.module}/kubeconfig"
}
