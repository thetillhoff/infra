# ansible

The roles in this folder are meant for *single-node* kubernetes clusters.

## Install ansible
```sh
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
sudo python3 get-pip.py
rm get-pip.py
sudo python3 -m pip install ansible
```

## Install requirements
`ansible-galaxy install -r requirements.yaml`

## Run ansible

Manual run for blackhole: `ansible-playbook blackhole.yaml -i inventory.yaml -bK`
> This assumes you'll log in as non-root user with password protected sudo

Manual run for kubenodes: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=pegasus ansible-playbook kubenodes.yaml -i ../inventory.yaml --key-file ~/.ssh/automation.key`

Automated run for kubenodes: `TAILSCALE_AUTH_TOKEN=<token> CONTROL_PLANE_ENDPOINT=<dnsname> CLUSTER_NAME=pegasus ansible-playbook kubenodes.yaml -i ../inventory.ini --key-file ~/.ssh/automation.key`
> This assumes you'll log in as root user
