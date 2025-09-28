# Usage

```sh
# From parent directory `task build`

# or
export PKR_VAR_HCLOUD_TOKEN=<your-hcloud-token>

# after version updates, run
packer init -upgrade -var-file=arm64.pkrvars.hcl talos-on-hcloud.pkr.hcl

packer build -var-file=amd64.pkrvars.hcl talos-on-hcloud.pkr.hcl
packer build -var-file=arm64.pkrvars.hcl talos-on-hcloud.pkr.hcl
```
