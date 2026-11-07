FROM python:3.15-alpine3.24@sha256:a0f2e268f2ce8f3709611a90054ec6a8ae31f6251f5896b8648b9bb99835e30a

# openssh: remote connection; sops: decrypt community.sops vars (age key)
RUN apk add --no-cache openssh sops

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
