# This inventory file is managed by Terraform. Do not change manually!
[kubenodes]
%{ for server in kubenodes ~}
${server}
%{ endfor ~}
