# ansible

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

Check Makefile targets.
