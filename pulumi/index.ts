import * as talos from "@pulumiverse/talos";
import * as fs from "fs";
import * as path from "path";

import { HcloudTalosNodegroups } from "./hcloud-talos-nodegroup-component/nodegroups";
import { HcloudTalosCluster } from "./hcloud-talos-cluster-component";
import { Dns } from "./dns";

const domain = "thetillhoff.de";
const k8sClusterName = "hydra";
const cloudflareZoneId = "94d9f474ce48a61513a68744b663f5e5";
const enableM365Dns = true;
const enableGoogleSiteVerification = "2HI_U5cyyFCcB2OlrH1Ir1BahesDBofU35pVikOQQvg";
const enableBlueskyVerification = "did:plc:yfywvq4oa4bx5gtd2fk3uenw";
const versions = {
  kubernetes: "v1.33.1",
  talos: "v1.10.3",
  cilium: "1.17.4", // From https://github.com/cilium/cilium/releases
  gatewayApiCrds: "v1.3.0", // From https://github.com/kubernetes-sigs/gateway-api/releases
  fluxOperator: "0.22.0", // From https://github.com/controlplaneio-fluxcd/flux-operator/releases
  flux: "v2.5.1", // From https://github.com/fluxcd/flux2/releases
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

const talosSecrets = new talos.machine.Secrets("talosSecrets", {});

const nodegroups = new HcloudTalosNodegroups(
  "hcloudTalosNodegroups",
  {
    "hcloud-talos-v1-11-2-controlplane": {
      nodeCount: 2,
      clusterName: k8sClusterName,
      clusterEndpointDomain: k8sClusterEndpointDomain,
      clusterDnsNames: clusterDnsNames,
      talosSecrets: talosSecrets,
      machineType: "controlplane",
      kubernetesVersion: versions.kubernetes,
      configPatches: [
        fs.readFileSync(
          path.join(
            __dirname,
            "hcloud-talos-nodegroup-component",
            "configPatches",
            "talos-v1-11-2-controlplane-patch.yaml",
          ),
          "utf8",
        ),
      ],

      hcloudLocation: "nbg1",

      hcloudImageId: "320728601", // arm64
      hcloudServerType: "cax21", // arm64
      // hcloudImageId: "301020001", // amd64
      // hcloudServerType: "cpx31", // amd64
      cloudflareZoneId: cloudflareZoneId,
    },
  },
  {},
);

const primaryControlplaneNodegroupName = "hcloud-talos-v1-11-2-controlplane";

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
    fluxInstanceYaml: fs.readFileSync(
      path.join(
        __dirname,
        "hcloud-talos-cluster-component",
        "fluxInstance.yaml",
      ),
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
