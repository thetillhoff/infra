terraform {
  backend "remote" {
    organization = "enforge"

    workspaces {
      name = "infra"
    }
  }

  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
    }

    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}

# Configure the Hetzner Cloud Provider
provider "hcloud" {
  token = var.HCLOUD_TOKEN
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  email   = var.CLOUDFLARE_EMAIL
  api_token = var.CLOUDFLARE_APITOKEN
}
