# ansible

## Install requirements
`ansible-galaxy install -r requirements.yaml`

## Run ansible
`TAILSCALE_AUTH_TOKEN=<token> GITHUB_TOKEN=<token> ansible-playbook infra.yaml -i ../inventory.ini --key-file ../id_ed25519`
