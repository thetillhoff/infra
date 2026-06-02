FROM ubuntu:26.04@sha256:f3d28607ddd78734bb7f71f117f3c6706c666b8b76cbff7c9ff6e5718d46ff64 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git pkg-config nasm yasm wget ca-certificates \
    libva-dev libdrm-dev \
    libx264-dev libx265-dev libnuma-dev \
    libvorbis-dev libopus-dev \
    && rm -rf /var/lib/apt/lists/*

ARG FFMPEG_VERSION=7.1.1

RUN wget -q "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2" \
    && tar xjf "ffmpeg-${FFMPEG_VERSION}.tar.bz2" \
    && cd "ffmpeg-${FFMPEG_VERSION}" \
    && ./configure \
        --disable-shared \
        --enable-static \
        --enable-vaapi \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libvorbis \
        --enable-libopus \
        --enable-gpl \
        --enable-version3 \
        --disable-doc \
        --disable-ffplay \
        --disable-debug \
    && make -j$(nproc) \
    && make install

FROM ubuntu:26.04@sha256:f3d28607ddd78734bb7f71f117f3c6706c666b8b76cbff7c9ff6e5718d46ff64

ENV DEBIAN_FRONTEND=noninteractive

# mesa-va-drivers: AMD RDNA2+ VA-API encoder (AV1, HEVC) via open-source Mesa drivers.
# libx264/libx265 versioned package names are discovered at build time to stay
# compatible across Ubuntu 24.x minor releases.
RUN apt-get update && \
    LIBX264=$(apt-cache search '^libx264-[0-9]+$' | awk '{print $1}' | head -1) && \
    LIBX265=$(apt-cache search '^libx265-[0-9]+$' | awk '{print $1}' | head -1) && \
    apt-get install -y --no-install-recommends \
        mesa-va-drivers \
        libva2 \
        libva-drm2 \
        libdrm2 \
        "$LIBX264" \
        "$LIBX265" \
        libnuma1 \
        libvorbis0a \
        libvorbisenc2 \
        libopus0 \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=builder /usr/local/bin/ffprobe /usr/local/bin/ffprobe

RUN ln -sf /usr/bin/python3 /usr/bin/python
