# ansible

The roles in this folder are meant for *single-node* kubernetes clusters.

## Install requirements
`ansible-galaxy install -r requirements.yaml`

## Run ansible

Manual run: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=blackhole ansible-playbook blackhole.yaml -i inventory.yaml -bK`
> This assumes you'll log in as non-root user with password protected sudo

Automated run: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=pegasus ansible-playbook kubenode.yaml -i ../inventory.ini --key-file ~/.ssh/automation.key`
> This assumes you'll log in as root user
