module "kubenodes" {
  source = "./kubenodes"

  cloudflare_zone_id = var.cloudflare_zone_id
  location           = var.location

  GITHUB_TOKEN        = var.GITHUB_TOKEN
  CLOUDFLARE_APITOKEN = var.CLOUDFLARE_APITOKEN
  HCLOUD_TOKEN        = var.HCLOUD_TOKEN_HYDRA

  create_local_config_files = true
  node_count                = 3
}
