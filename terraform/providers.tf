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
      version = "1.39.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.7.1"
    }

    github = {
      source  = "integrations/github"
      version = "5.26.0"
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

provider "github" {
  token = var.GITHUB_TOKEN
}
