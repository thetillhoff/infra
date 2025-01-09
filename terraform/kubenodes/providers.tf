terraform {
  required_version = ">= 1.5"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
    }

    github = {
      source  = "integrations/github"
      version = "6.4.0"
    }

    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "1.49.1"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.50.0"
    }

    flux = {
      source  = "fluxcd/flux"
      version = "1.4.0"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "2.16.1"
    }

    time = {
      source  = "hashicorp/time"
      version = "0.12.1"
    }

    talos = {
      source  = "siderolabs/talos"
      version = "0.7.0-alpha.0"
    }

    tls = {
      source  = "hashicorp/tls"
      version = "4.0.6"
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

provider "flux" {
  kubernetes = {
    host = talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.host

    client_certificate     = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_certificate)
    client_key             = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_key)
    cluster_ca_certificate = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.ca_certificate)
  }
  git = {
    url = "https://github.com/thetillhoff/infra"
    http = {
      username = "git" # This can be any string when using a personal access token
      password = var.GITHUB_TOKEN
    }
  }
}

provider "helm" {
  kubernetes {
    host = talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.host

    client_certificate     = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_certificate)
    client_key             = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_key)
    cluster_ca_certificate = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.ca_certificate)
  }
}
