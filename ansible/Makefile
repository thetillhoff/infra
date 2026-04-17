# Variables
PLAYBOOK ?= blackhole.yaml
ANSIBLE_PLAYBOOK_CMD = ansible-playbook $(PLAYBOOK) -i inventory.yaml
DOCKER_RUN = docker run --rm -it -v $(HOME)/.ssh:/root/.ssh:ro -v $(CURDIR):/app -w /app --privileged ansible

.PHONY: help run check lint docker-build docker-run docker-check docker-lint

.DEFAULT_GOAL := help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-15s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Execution

run: ## Run the ansible playbook
	$(ANSIBLE_PLAYBOOK_CMD) -b

check: ## Dry-run playbook execution
	$(ANSIBLE_PLAYBOOK_CMD) -b --check

##@ Validation

lint: ## Run syntax check and ansible-lint
	$(ANSIBLE_PLAYBOOK_CMD) --syntax-check
	@command -v ansible-lint >/dev/null 2>&1 || { echo "ansible-lint not found. Install with: pip install ansible-lint"; exit 1; }
	ansible-lint $(PLAYBOOK)

##@ Docker

docker-build: ## Build ansible container image
	docker build -t ansible .

docker-run: ## Run playbook inside container
	$(DOCKER_RUN) $(ANSIBLE_PLAYBOOK_CMD) -b

docker-check: ## Dry-run playbook inside container
	$(DOCKER_RUN) $(ANSIBLE_PLAYBOOK_CMD) -b --check

docker-lint: ## Run syntax check and ansible-lint inside container
	$(DOCKER_RUN) $(ANSIBLE_PLAYBOOK_CMD) --syntax-check
	$(DOCKER_RUN) ansible-lint $(PLAYBOOK)

docker-debug: ## Debug container
	$(DOCKER_RUN) sh
