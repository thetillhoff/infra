FROM python:alpine3.22@sha256:fa0d6242867bdaf06de57eba14e9a01d86d399c4e45bf206ed334394a52adc77

RUN apk add --no-cache openssh

RUN pip install ansible ansible-core

WORKDIR /app

COPY requirements.yaml /app/requirements.yaml

RUN ansible-galaxy install -r /app/requirements.yaml

CMD [ "sh", "-c" ]
