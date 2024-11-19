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
      version = "1.49.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.46.0"
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
