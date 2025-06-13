import * as talos from "@pulumiverse/talos";
import * as cloudflare from "@pulumi/cloudflare";

import { HcloudTalosNodegroups } from "./hcloud-talos-nodegroup-component/nodegroups";
import { HcloudTalosCluster } from "./hcloud-talos-cluster-component";
import * as fs from "fs";
import * as path from "path";

const talosSecrets = new talos.machine.Secrets("talosSecrets", {});

const clusterName = "hydra";
const clusterEndpointDomain = "k8s.hydra.thetillhoff.de";
const cloudflareZoneId = "94d9f474ce48a61513a68744b663f5e5";

const nodegroups = new HcloudTalosNodegroups(
  "hcloudTalosNodegroups",
  {
    "hcloud-talos-v1-10-3-controlplane": {
      nodeCount: 2,
      clusterName: clusterName,
      clusterEndpointDomain: clusterEndpointDomain,
      talosSecrets: talosSecrets,
      machineType: "controlplane",
      kubernetesVersion: "v1.33.1",
      configPatches: [
        fs.readFileSync(
          path.join(
            __dirname,
            "hcloud-talos-nodegroup-component",
            "configPatches",
            "talos-v1-10-3-controlplane-patch.yaml",
          ),
          "utf8",
        ),
      ],
      hcloudLocation: "nbg1",

      hcloudImageId: "241435885", // arm64
      hcloudServerType: "cax21", // arm64

      // hcloudImageId: '241003589', // amd64
      // hcloudServerType: 'cpx31', // amd64

      cloudflareZoneId: cloudflareZoneId,
    },
  },
  {},
);

const primaryControlplaneNodegroupName = "hcloud-talos-v1-10-3-controlplane";

const hcloudTalosCluster = new HcloudTalosCluster(
  "hcloud-talos-cluster",
  {
    bootstrapNodeIpAddress: nodegroups.controlplaneIpv4Addresses[0],
    clusterEndpointDomain: clusterEndpointDomain,
    talosSecrets: talosSecrets,
    ciliumVersion: "1.17.4", // From https://github.com/cilium/cilium/releases
    gatewayApiCrdsVersion: "v1.3.0", // From https://github.com/kubernetes-sigs/gateway-api/releases
    fluxOperatorVersion: "0.22.0", // From https://github.com/controlplaneio-fluxcd/flux-operator/releases
    fluxVersion: "v2.5.1", // From https://github.com/fluxcd/flux2/releases
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

nodegroups.ipv4Addresses.apply((ipv4Addresses) => {
  for (let i = 0; i < ipv4Addresses.length; i++) {
    new cloudflare.DnsRecord(
      `dev-aRecord-${i}`,
      {
        name: "dev.thetillhoff.de",
        type: "A",
        ttl: 60,
        content: ipv4Addresses[i],
        zoneId: cloudflareZoneId,
      },
      {
        dependsOn: [hcloudTalosCluster],
      },
    );
  }
});

export const talosconfig =
  nodegroups.nodegroups[primaryControlplaneNodegroupName].talosconfig;
export const kubeconfig = hcloudTalosCluster.kubeconfig;
