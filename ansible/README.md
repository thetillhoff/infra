# ansible

The roles in this folder are meant for *single-node* kubernetes clusters.

## Install ansible
```sh
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
sudo python3 get-pip.py
rm get-pip.py

sudo apt-get install -y pipx
pipx ensurepath
pipx install --include-deps ansible
```

## Install requirements
`ansible-galaxy install -r requirements.yaml`

## Run ansible

Manual run for blackhole: `ansible-playbook blackhole.yaml -i inventory.yaml -bK`
> This assumes you'll log in as non-root user with password protected sudo

Optional additions: `TAILSCALE_AUTH_TOKEN=<token> ... --key-file ~/.ssh/automation.key`
