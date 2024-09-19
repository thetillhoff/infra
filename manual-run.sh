#!/bin/sh

apt install python3-pip -y

python3 -m pip install ansible

ansible-galaxy install -r "ansible/requirements.yaml"

# if [ -z "$GPG_PASSWORD" ]; then
  # echo "GPG_PASSWORD is required."
  # exit 0
# fi
# git reset --hard
# find . -name '*.gpg' -exec gpg --batch --yes --decrypt --passphrase "$GPG_PASSWORD" -o '{}' '{}' \;

CONTROL_PLANE_ENDPOINT="$(hostname)" \
  CLUSTER_NAME="$(hostname)" \
  ansible-playbook "ansible/$(hostname).yaml" -i "ansible/inventory.yaml" -bK
