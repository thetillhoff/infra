import { machine } from "@pulumiverse/talos";
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
  kubernetes: "v1.34.2",
  cilium: "1.19.2", // From https://github.com/cilium/cilium/releases
  gatewayApiCrds: "v1.4.1", // From https://github.com/kubernetes-sigs/gateway-api/releases
  fluxOperator: "0.36.0", // From https://github.com/controlplaneio-fluxcd/flux-operator/releases
  flux: "v2.7.5", // From https://github.com/fluxcd/flux2/releases
};
const clusterDnsNames = [
  `${domain}`,
  `link.${domain}`,
  `analytics.${domain}`,
  `pw.${domain}`,
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

const talosSecrets = new machine.Secrets("talosSecrets", {});

const nodegroups = new HcloudTalosNodegroups(
  "hcloudTalosNodegroups",
  {
    "hcloud-talos-v1-12-6-controlplane": {
      nodeCount: 2,
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
            "talos-v1-12-6-controlplane-patch.yaml",
          ),
          "utf8",
        ),
      ],

      hcloudLocation: "nbg1",

      hcloudImageId: "372067998",
      // hcloudServerType: "cax21", // arm64
      hcloudServerType: "cx33", // amd64
      cloudflareZoneId: cloudflareZoneId,
    },
  },
  {},
);

const primaryControlplaneNodegroupName = "hcloud-talos-v1-12-6-controlplane";

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
