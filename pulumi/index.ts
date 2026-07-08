import { machine } from "@pulumiverse/talos";
import * as tailscale from "@pulumi/tailscale";
import { readFileSync } from "fs";
import { join } from "path";

import { HcloudTalosNodegroups } from "./hcloud-talos-nodegroup-component/nodegroups";
import { HcloudTalosCluster } from "./hcloud-talos-cluster-component";
import { Dns } from "./dns";

const domain = "thetillhoff.de";
const k8sClusterName = "hydra";
const cloudflareZoneId = "94d9f474ce48a61513a68744b663f5e5";
const enableM365Dns = true;
const enableGoogleSiteVerification =
  "2HI_U5cyyFCcB2OlrH1Ir1BahesDBofU35pVikOQQvg";
const enableBlueskyVerification = "did:plc:yfywvq4oa4bx5gtd2fk3uenw";
const versions = {
  kubernetes: "v1.36.2", // From https://kubernetes.io/releases/
  cilium: "1.19.5", // From https://github.com/cilium/cilium/releases
  gatewayApiCrds: "v1.6.0", // From https://github.com/kubernetes-sigs/gateway-api/releases
  fluxOperator: "0.53.0", // From https://github.com/controlplaneio-fluxcd/flux-operator/releases
  flux: "v2.9.0", // From https://github.com/fluxcd/flux2/releases
};
const clusterDnsNames = [
  `${domain}`,
  `link.${domain}`,
  `analytics.${domain}`,
  `pw.${domain}`,
  `webscan.${domain}`,
  `wedding.${domain}`,
  // "logs.thetillhoff.de",
];

const k8sClusterEndpointDomain = `${k8sClusterName}.k8s.${domain}`;

new Dns(
  "dns",
  {
    domain: domain,
    cloudflareZoneId: cloudflareZoneId,
    m365Dns: enableM365Dns,
    googleSiteVerification: enableGoogleSiteVerification,
    blueskyVerification: enableBlueskyVerification,
  },
  {},
);

// Tailnet ACL — manages the whole tailnet policy (see pulumi/tailscale-acl.hujson).
// pulumi is the source of truth: overwriteExistingContent enforces the hujson on
// every `up` (console edits get reverted) and removes the need to `pulumi import`
// before (re)deploys. retainOnDelete leaves the live policy intact on `destroy`.
// Requires tailscale:oauthClientId/oauthClientSecret (OAuth client, Policy File scope).
new tailscale.Acl(
  "tailnet-acl",
  {
    acl: readFileSync(join(__dirname, "tailscale-acl.hujson"), "utf8"),
    overwriteExistingContent: true,
  },
  { retainOnDelete: true },
);

const talosSecrets = new machine.Secrets("talosSecrets", {});

const nodegroups = new HcloudTalosNodegroups(
  "hcloudTalosNodegroups",
  {
    "hcloud-talos-v1-13-4-controlplane": {
      nodeCount: 3,
      clusterName: k8sClusterName,
      clusterEndpointDomain: k8sClusterEndpointDomain,
      clusterDnsNames: clusterDnsNames,
      talosSecrets: talosSecrets,
      machineType: "controlplane",
      kubernetesVersion: versions.kubernetes,
      configPatches: [
        readFileSync(
          join(
            __dirname,
            "hcloud-talos-nodegroup-component",
            "configPatches",
            "talos-v1-13-4-controlplane-patch.yaml",
          ),
          "utf8",
        ),
      ],

      hcloudLocation: "nbg1",

      hcloudImageId: "398555717",
      // hcloudServerType: "cax21", // arm64
      hcloudServerType: "cx33", // amd64
      cloudflareZoneId: cloudflareZoneId,
    },
  },
  {},
);

const primaryControlplaneNodegroupName = "hcloud-talos-v1-13-4-controlplane";

const hcloudTalosCluster = new HcloudTalosCluster(
  "hcloud-talos-cluster",
  {
    clusterNodegroups: nodegroups,
    cloudflareZoneId: cloudflareZoneId,
    clusterEndpointDomain: k8sClusterEndpointDomain,
    talosSecrets: talosSecrets,
    ciliumVersion: versions.cilium,
    gatewayApiCrdsVersion: versions.gatewayApiCrds,
    fluxOperatorVersion: versions.fluxOperator,
    fluxVersion: versions.flux,
    fluxInstanceYaml: readFileSync(
      join(__dirname, "hcloud-talos-cluster-component", "fluxInstance.yaml"),
      "utf8",
    ),
    gitUsername: "git",
  },
  {
    deletedWith: nodegroups,
    dependsOn: [nodegroups, ...nodegroups.dnsTTLWaiters],
  },
);

export const talosconfig =
  nodegroups.nodegroups[primaryControlplaneNodegroupName].talosconfig;
export const kubeconfig = hcloudTalosCluster.kubeconfig;
