import * as pulumi from "@pulumi/pulumi";
import * as talos from "@pulumiverse/talos";
import * as kubernetes from "@pulumi/kubernetes";
import * as time from "@pulumiverse/time";

import { HcloudTalosNodegroups } from "../hcloud-talos-nodegroup-component/nodegroups";

export interface HcloudTalosClusterArgs {
  clusterEndpointDomain: pulumi.Input<string>;
  clusterNodegroups: HcloudTalosNodegroups;
  cloudflareZoneId: pulumi.Input<string>;
  talosSecrets: talos.machine.Secrets;
  ciliumVersion: pulumi.Input<string>;
  gatewayApiCrdsVersion: pulumi.Input<string>;
  fluxOperatorVersion: pulumi.Input<string>;
  fluxVersion: pulumi.Input<string>;
  fluxInstanceYaml: pulumi.Input<string>;
  gitUsername: pulumi.Input<string>;
}

export class HcloudTalosCluster extends pulumi.ComponentResource {
  public readonly kubeconfig: pulumi.Output<string>;

  constructor(
    name: string,
    props: HcloudTalosClusterArgs,
    opts: pulumi.ComponentResourceOptions,
  ) {
    super(
      "hcloud-talos-cluster-component:index:HcloudTalosCluster",
      name,
      {},
      opts,
    );

    const bootstrapNodeIpAddress =
      props.clusterNodegroups.controlplaneIpv4Addresses[0];

    const talosBootstrap = new talos.machine.Bootstrap(
      "talosBootstrap",
      {
        clientConfiguration: props.talosSecrets.clientConfiguration,
        node: bootstrapNodeIpAddress,
        timeouts: {
          create: "3m",
        },
      },
      {
        parent: this,
        ignoreChanges: ["node"],
      },
    );

    const talosBootstrapWaiter = new time.Sleep(
      `waitForTalosBootstrap`,
      { createDuration: "30s" },
      {
        parent: this,
        dependsOn: [talosBootstrap],
      },
    );

    const talosKubeconfig = new talos.cluster.Kubeconfig(
      "talosKubeconfig",
      {
        clientConfiguration: props.talosSecrets.clientConfiguration,
        node: bootstrapNodeIpAddress,
      },
      {
        parent: this,
      },
    );

    this.kubeconfig = talosKubeconfig.kubeconfigRaw;

    const kubernetesProvider = new kubernetes.Provider(
      "kubernetesProvider",
      {
        kubeconfig: talosKubeconfig.kubeconfigRaw,
      },
      {
        parent: this,
        // dependsOn: [dnsRecords],
      },
    );

    const gatewayApiCrds = new kubernetes.yaml.v2.ConfigFile(
      "gatewayApiCrds",
      {
        file: `https://github.com/kubernetes-sigs/gateway-api/releases/download/${props.gatewayApiCrdsVersion}/standard-install.yaml`,
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [talosBootstrapWaiter],
      },
    );

    // Deploy cilium
    const ciliumHelmRelease = new kubernetes.helm.v4.Chart(
      "ciliumHelmRelease",
      {
        name: "cilium",
        namespace: "kube-system",
        chart: "cilium",
        version: props.ciliumVersion,
        repositoryOpts: {
          repo: "https://helm.cilium.io/",
        },
        valueYamlFiles: [new pulumi.asset.FileAsset("./cilium-values.yaml")],
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [gatewayApiCrds],
      },
    );

    const fluxNamespace = new kubernetes.core.v1.Namespace(
      "fluxNamespace",
      {
        metadata: {
          name: "flux-system",
        },
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [ciliumHelmRelease],
      },
    );

    const fluxOperatorHelmRelease = new kubernetes.helm.v4.Chart(
      "fluxOperatorHelmRelease",
      {
        name: "flux-operator",
        namespace: fluxNamespace.metadata.name,
        chart: "oci://ghcr.io/controlplaneio-fluxcd/charts/flux-operator",
        version: props.fluxOperatorVersion,
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [fluxNamespace],
      },
    );

    const cfg = new pulumi.Config();

    const fluxGitAuthSecret = new kubernetes.core.v1.Secret(
      "fluxGitAuthSecret",
      {
        metadata: {
          name: "git-auth",
          namespace: fluxNamespace.metadata.name,
        },
        stringData: {
          username: props.gitUsername,
          password: cfg.requireSecret("flux.git-auth"),
        },
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [fluxNamespace],
      },
    );

    const fluxSopsAgeSecret = new kubernetes.core.v1.Secret(
      "fluxSopsAgeSecret",
      {
        metadata: {
          name: "sops-age",
          namespace: fluxNamespace.metadata.name,
        },
        stringData: {
          // The `.agekey` suffix is required to specify an age private key for flux
          "age.agekey": cfg.requireSecret("flux.sops-age"),
        },
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [fluxNamespace],
      },
    );

    new kubernetes.yaml.v2.ConfigGroup(
      "fluxInstance",
      {
        yaml: props.fluxInstanceYaml,
      },
      {
        parent: this,
        provider: kubernetesProvider,
        dependsOn: [
          fluxOperatorHelmRelease,
          fluxGitAuthSecret,
          fluxSopsAgeSecret,
        ],
      },
    );

    this.registerOutputs({
      kubeconfig: this.kubeconfig,
    });
  }
}
