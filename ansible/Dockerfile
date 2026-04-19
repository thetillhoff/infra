FROM python:alpine3.22@sha256:355522f4e6b640e9255e6b6830ef52f32ece54df43db93f61101f48c5d4c6658

RUN apk add --no-cache openssh

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
