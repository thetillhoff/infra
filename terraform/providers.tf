terraform {
  backend "remote" {
    organization = "enforge"

    workspaces {
      name = "infra"
    }
  }

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.41.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.10.0"
    }
  }
}

# Configure the Hetzner Cloud Provider
provider "hcloud" {
  token = var.HCLOUD_TOKEN
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  api_token = var.CLOUDFLARE_APITOKEN
}
