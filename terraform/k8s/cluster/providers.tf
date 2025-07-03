terraform {
  required_providers {
    talos = {
      source = "siderolabs/talos"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.37.1"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "3.0.2"
    }

    flux = {
      source  = "fluxcd/flux"
      version = "1.6.3"
    }
  }
}

provider "kubernetes" {
  host = talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.host

  client_certificate     = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_certificate)
  client_key             = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.client_key)
  cluster_ca_certificate = base64decode(talos_cluster_kubeconfig.kubeconfig.kubernetes_client_configuration.ca_certificate)
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
