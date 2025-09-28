import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";
import * as talos from "@pulumiverse/talos";
import * as cloudflare from "@pulumi/cloudflare";
import * as time from "@pulumiverse/time";

export interface HcloudTalosNodegroupArgs {
  clusterName: pulumi.Input<string>;
  clusterEndpointDomain: pulumi.Input<string>;
  clusterDnsNames: pulumi.Input<string>[];
  talosSecrets: talos.machine.Secrets;
  machineType: pulumi.Input<string>; // 'controlplane' or 'worker'
  kubernetesVersion: pulumi.Input<string>; // like 'v1.33.1'
  configPatches: pulumi.Input<pulumi.Input<string>[]>;
  hcloudImageId: pulumi.Input<string>;
  hcloudLocation: pulumi.Input<string>;
  hcloudServerType: pulumi.Input<string>;
  nodeCount: number;
  cloudflareZoneId: string;
}

export class HcloudTalosNodegroup extends pulumi.ComponentResource {
  public readonly nodes: hcloud.Server[] = [];
  public readonly talosconfig?: pulumi.Output<string>;
  public readonly dnsTTLWaiters: time.Sleep[] = [];

  constructor(
    name: string,
    props: HcloudTalosNodegroupArgs,
    opts: pulumi.ComponentResourceOptions,
  ) {
    super(
      "hcloud-talos-nodegroup-component:index:HcloudTalosNodegroup",
      name,
      {},
      opts,
    );

    for (let i = 0; i < props.nodeCount; i++) {
      this.nodes.push(
        new hcloud.Server(
          `${name}-node-${i}`,
          {
            // name: props.name, // Using auto-names instead
            image: props.hcloudImageId,
            location: props.hcloudLocation,
            serverType: props.hcloudServerType,
            publicNets: [
              {
                ipv4Enabled: true,
                ipv6Enabled: true,
              },
            ],
            shutdownBeforeDeletion: true,
          },
          {
            parent: this,
          },
        ),
      );

      for (const dnsName of [props.clusterEndpointDomain, ...props.clusterDnsNames]) {

      const dnsARecord = new cloudflare.DnsRecord(
        `${name}-aRecord-${dnsName}-node-${i}`,
        {
          name: dnsName,
          type: "A",
          ttl: 60,
          content: this.nodes[i].ipv4Address,
          zoneId: props.cloudflareZoneId,
        },
        {
          parent: this,
        },
      );

      this.dnsTTLWaiters.push(
        new time.Sleep(
          `${name}-waitForDnsARecordTTL-${dnsName}-node-${i}`,
          { createDuration: "60s" },
          {
            dependsOn: [dnsARecord],
          },
        ),
      );

      const dnsAAAARecord = new cloudflare.DnsRecord(
        `${name}-aaaaRecord-${dnsName}-node-${i}`,
        {
          name: dnsName,
          type: "AAAA",
          ttl: 60,
          content: this.nodes[i].ipv6Address,
          zoneId: props.cloudflareZoneId,
        },
        {
          parent: this,
        },
      );

      this.dnsTTLWaiters.push(
        new time.Sleep(
          `${name}-waitForDnsAAAARecordTTL-${dnsName}-node-${i}`,
          { createDuration: "60s" },
          {
            dependsOn: [dnsAAAARecord],
          },
        ),
      );
    };

      const talosMachineConfiguration = talos.machine.getConfigurationOutput({
        clusterName: props.clusterName,
        machineType: props.machineType,
        clusterEndpoint: `https://${props.clusterEndpointDomain}:6443`,
        machineSecrets: props.talosSecrets.machineSecrets,
        kubernetesVersion: props.kubernetesVersion,
        examples: false,
        docs: false,
        configPatches: props.configPatches,
      });

      const clientConfiguration = talos.client.getConfigurationOutput({
        clusterName: props.clusterName,
        clientConfiguration: props.talosSecrets.clientConfiguration,
        nodes: [this.nodes[i].ipv4Address],
      });

      new talos.machine.ConfigurationApply(
        `${name}-configurationApply-node-${i}`,
        {
          clientConfiguration: clientConfiguration.clientConfiguration,
          machineConfigurationInput:
            talosMachineConfiguration.machineConfiguration,
          node: this.nodes[i].ipv4Address,
          configPatches: props.configPatches,
        },
        {
          parent: this,
          dependsOn: [this.nodes[i]],
        },
      );
    }

    if (props.machineType === "controlplane") {
      const clientConfiguration = talos.client.getConfigurationOutput({
        clusterName: props.clusterName,
        clientConfiguration: props.talosSecrets.clientConfiguration,
        nodes: this.nodes.map((node) => node.ipv4Address),
        endpoints: this.nodes.map((node) => node.ipv4Address),
      });

      this.talosconfig = clientConfiguration.talosConfig;
    }

    // By registering the outputs on which the component depends, we ensure
    // that the Pulumi CLI will wait for all the outputs to be created before
    // considering the component itself to have been created.
    this.registerOutputs({
      nodes: this.nodes,
      talosconfig: this.talosconfig,
      dnsTTLWaiters: this.dnsTTLWaiters,
    });
  }
}
