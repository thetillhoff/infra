# It should only be necessary to adjust the talos_version.

talos_version = "v1.11.2"
arch          = "amd64" # must match server_type
# Plain talos image from https://factory.talos.dev/
# image_id      = "376567988ad370138ad8b2698212367b8edcb69b5fd68c80be1f2ec7d603b4ba"
# Talos image for longhorn from https://factory.talos.dev/?arch=amd64&cmdline-set=true&extensions=-&extensions=siderolabs%2Fiscsi-tools&extensions=siderolabs%2Futil-linux-tools&platform=hcloud&target=cloud&version=1.10.3
# extensions: siderolabs/iscsi-tools, siderolabs/util-linux-tools
image_id = "613e1592b2da41ae5e265e8789429f22e121aab91cb4deb6bc3c0b6262961245"
server_type   = "cpx31" # must match arch
