# Terraform

## Prerequisites
- Create an ssh key with `ssh-keygen -t ed25519 -C "your_email@example.com"`.

## Required variables
Place them in a `secret.auto.tfvars` file.
```
# use \n as line seperator in ssh key
# KUBENODE_SSH_PRIVATE_KEY = ""
HCLOUD_TOKEN             = ""
HCLOUD_TOKEN_HYDRA       = ""
CLOUDFLARE_APITOKEN      = ""
GITHUB_TOKEN             = "" # Use GH_PAT_FLUX from github actions
```

## Execution
`terraform login`
`terraform init`
`terraform plan`
`terraform apply -input=false -auto-approve`
`terraform apply -var="create_local_config_files=true"`

## Debugging
cloud-init logs are at /var/log/cloud-init-output.log

example manual api call: `curl --request GET --url https://api.cloudflare.com/client/v4/zones -H 'Content-Type: application/json' -H "Authorization: Bearer <API-TOKEN>"`
