# Terraform

## Prerequisites
- Create an ssh key with `ssh-keygen -t ed25519 -C "your_email@example.com"`.
  In this case, the email was infra@enforge.de.
- Create a file `secret.auto.tfvars` (already included in the gitignore) and add the required secrets there.
  Refer to the section `Required environment variables` for secrets that must be provided via environment variables.

## Required environment variables
```
SSH_PUBLIC_KEY
SSH_PRIVATE_KEY # use \n as line seperator
TERRAFORM_TOKEN
TF_VAR_HCLOUD_TOKEN
TF_VAR_CLOUDFLARE_EMAIL
TF_VAR_CLOUDFLARE_APIKEY

TF_VAR_DNS_SUFFIX # basically the base domain; can vary between environments
```

## Debugging
cloud-init logs are at /var/log/cloud-init-output.log
