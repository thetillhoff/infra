#!/bin/sh

apt install python3-pip -y

python3 -m pip install ansible

ansible-galaxy install -r "ansible/requirements.yaml"

CONTROL_PLANE_ENDPOINT="$(hostname)" \
  CLUSTER_NAME="$(hostname)" \
  ansible-playbook "ansible/$(hostname).yaml" -i "ansible/inventory.yaml" -bK
