FROM ubuntu:26.04@sha256:3131b4cc82a783df6c9df078f86e01819a13594b865c2cad47bd1bca2b7063bb

# Install Samba (v4.15.13-Ubuntu at time of writing)
RUN \
  apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y samba samba-common-bin samba-vfs-modules && \
  rm -rf /var/lib/apt/lists/*

# Copy configuration and startup script
COPY --chmod=0744 start.sh /start.sh
COPY smb.conf /etc/samba/smb.conf

CMD ["/usr/bin/bash", "-c", "/start.sh"]

# Then access with `\\ip-address\share` for windows or `smb://ip-address/share` for linux and mac
#   The `\` for windows is important
# `net use i: \\192.168.1.177\share /user:username password /p:yes
# `net use i: /delete` # (or just `/d`)
# for windows: please note, that credentials are per hostname, so all shares of the same host need to use the same credentials
