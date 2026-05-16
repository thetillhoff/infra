FROM python:alpine3.22@sha256:6b91e66ab2a880ce9ca5a1b91c70f45963ff71ff68268df056336e1a657d5efd

RUN apk add --no-cache openssh

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
