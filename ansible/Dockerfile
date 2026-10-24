FROM python:3.15-alpine3.24@sha256:d44b1254cb92329418d164b22b20d86bbd3869d48e80e09e476531a409a728bb

# openssh: remote connection; sops: decrypt community.sops vars (age key)
RUN apk add --no-cache openssh sops

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
