terraform {
  required_version = ">= 1.5"

  backend "remote" {
    organization = "enforge"

    workspaces {
      name = "infra"
    }
  }

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
    }

    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.49.1"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.48.0"
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
