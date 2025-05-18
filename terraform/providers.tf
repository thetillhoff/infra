terraform {
  required_version = ">= 1.5"

  backend "remote" {
    organization = "enforge"

    workspaces {
      name = "infra"
    }
  }

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.50.1"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.52.0" # to be upgraded to v5, but currently, v5 has a lot of issues in github (and docs are not very good)
    }

    talos = {
      source  = "siderolabs/talos"
      version = "0.8.1"
    }
  }
}

# Configure the Hetzner Cloud Provider
provider "hcloud" {
  alias = "hcloud-pegasus"
  token = var.HCLOUD_TOKEN
}

provider "hcloud" {
  alias = "hcloud-hydra"
  token = var.HCLOUD_TOKEN_HYDRA
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  api_token = var.CLOUDFLARE_APITOKEN
}
