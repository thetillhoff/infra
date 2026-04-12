FROM jrottenberg/ffmpeg:8.0-ubuntu-edge@sha256:729ee77da303f70ffaa12aa54f5f60375ccbd2e352bcb67cfaf3a94d477db859

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
