FROM jrottenberg/ffmpeg:8.0-ubuntu-edge@sha256:c5d2958a5191613a922c4215b33a91d909776173e94871fcd27a9edbcb29ef3c

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
