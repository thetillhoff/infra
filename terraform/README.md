# Terraform.

## Prerequisites
- Create an ssh key with `ssh-keygen -t ed25519 -C "your_email@example.com"`.

## Required variables
Place them in a `secret.auto.tfvars` file.
```
# use \n as line seperator in ssh key
KUBENODE_SSH_PRIVATE_KEY = ""
HCLOUD_TOKEN             = ""
CLOUDFLARE_APITOKEN      = ""
GITHUB_TOKEN             = ""
```

## Execution
`terraform login`
`terraform init`
`terraform plan`
`terraform apply -input=false -auto-approve`

## Debugging
cloud-init logs are at /var/log/cloud-init-output.log

example manual api call: `curl --request GET --url https://api.cloudflare.com/client/v4/zones -H 'Content-Type: application/json' -H "Authorization: Bearer <API-TOKEN>"`
