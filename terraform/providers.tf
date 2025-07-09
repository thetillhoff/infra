terraform {
  required_version = ">= 1.5"

  backend "remote" {
    organization = "enforge"

    workspaces {
      name = "infra"
    }
  }

  required_providers {

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.6.0" # to be upgraded to v5, but currently, v5 has a lot of issues in github (and docs are not very good)
    }
  }
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  api_token = var.CLOUDFLARE_APITOKEN
}
