import * as pulumi from "@pulumi/pulumi";
import * as time from "@pulumiverse/time";
import { HcloudTalosNodegroup, HcloudTalosNodegroupArgs } from "./nodegroup";

export class HcloudTalosNodegroups extends pulumi.ComponentResource {
  public readonly nodegroups: Record<string, HcloudTalosNodegroup> = {};
  public readonly controlplaneIpv4Addresses: pulumi.Output<string[]> =
    pulumi.output([]);
  public readonly controlplaneIpv6Addresses: pulumi.Output<string[]> =
    pulumi.output([]);
  public readonly ipv4Addresses: pulumi.Output<string[]> = pulumi.output([]);
  public readonly ipv6Addresses: pulumi.Output<string[]> = pulumi.output([]);
  public readonly dnsTTLWaiters: time.Sleep[] = [];

  constructor(
    name: string,
    props: Record<string, HcloudTalosNodegroupArgs>,
    opts: pulumi.ComponentResourceOptions,
  ) {
    super(
      "hcloud-talos-nodegroup-component:index:HcloudTalosNodegroups",
      name,
      {},
      opts,
    );

    // Collect all node IPv4 and IPv6 addresses
    const allIpv4Addresses: pulumi.Output<string>[] = [];
    const allIpv6Addresses: pulumi.Output<string>[] = [];
    const allControlplaneIpv4Addresses: pulumi.Output<string>[] = [];
    const allControlplaneIpv6Addresses: pulumi.Output<string>[] = [];

    for (const [name, nodegroupProps] of Object.entries(props)) {
      this.nodegroups[name] = new HcloudTalosNodegroup(name, nodegroupProps, {
        parent: this,
      });

      allIpv4Addresses.push(
        ...this.nodegroups[name].nodes.map((node) => node.ipv4Address),
      );

      allIpv6Addresses.push(
        ...this.nodegroups[name].nodes.map((node) => node.ipv6Address),
      );

      if (nodegroupProps.machineType === "controlplane") {
        allControlplaneIpv4Addresses.push(
          ...this.nodegroups[name].nodes.map((node) => node.ipv4Address),
        );
        allControlplaneIpv6Addresses.push(
          ...this.nodegroups[name].nodes.map((node) => node.ipv6Address),
        );
      }

      this.dnsTTLWaiters.push(...this.nodegroups[name].dnsTTLWaiters);
    }

    // Convert arrays of Output<string> to Output<string[]>
    this.ipv4Addresses = pulumi.all(allIpv4Addresses);
    this.ipv6Addresses = pulumi.all(allIpv6Addresses);
    this.controlplaneIpv4Addresses = pulumi.all(allControlplaneIpv4Addresses);
    this.controlplaneIpv6Addresses = pulumi.all(allControlplaneIpv6Addresses);

    this.registerOutputs({
      nodegroups: this.nodegroups,
      dnsTTLWaiters: this.dnsTTLWaiters,
      ipv4Addresses: this.ipv4Addresses,
      ipv6Addresses: this.ipv6Addresses,
      controlplaneIpv4Addresses: this.controlplaneIpv4Addresses,
      controlplaneIpv6Addresses: this.controlplaneIpv6Addresses,
    });
  }
}
