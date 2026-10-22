FROM python:3.14-alpine3.24@sha256:601e99e090cb08c2784a42395487709500bc39930307fe72f3f11a8f3c430762

# openssh: remote connection; sops: decrypt community.sops vars (age key)
RUN apk add --no-cache openssh sops

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
