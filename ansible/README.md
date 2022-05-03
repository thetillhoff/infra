# ansible

The roles in this folder are meant for *single-node* kubernetes clusters.

## Install requirements
`ansible-galaxy install -r requirements.yaml`

## Run ansible

Manual run: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=blackhole ansible-playbook infra.yaml -i inventory.yaml --key-file ~/.ssh/id_rsa -bK`
> This assumes you'll log in as non-root user with password protected sudo

Automated run: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=pegasus ansible-playbook infra.yaml -i ../inventory.ini --key-file ../id_ed25519`
> This assumes you'll log in as root user
