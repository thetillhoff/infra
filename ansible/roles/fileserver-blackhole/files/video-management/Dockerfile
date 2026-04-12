FROM jrottenberg/ffmpeg:8.1-ubuntu-edge@sha256:56db6ff853a23da41af2c0f3205135085280311506de4b756858da1f2e2d5c95

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
