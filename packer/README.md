# Usage

```sh
# From parent directory `task build`

# or
export PKR_VAR_HCLOUD_TOKEN=<your-hcloud-token>

packer build -var-file=amd64.pkrvars.hcl -color=false talos-on-hcloud.pkr.hcl
# packer build -var-file=arm64.pkrvars.hcl -color=false talos-on-hcloud.pkr.hcl
```
