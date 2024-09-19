#!/bin/sh

# curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
# sudo python3 get-pip.py
# rm get-pip.py

# sudo apt-get install -y pipx
pipx ensurepath
# pipx install --include-deps ansible

ansible-galaxy install -r "ansible/requirements.yaml"

CONTROL_PLANE_ENDPOINT="$(hostname)" \
  CLUSTER_NAME="$(hostname)" \
  ansible-playbook "ansible/$(hostname).yaml" -i "ansible/inventory.yaml" -bK
