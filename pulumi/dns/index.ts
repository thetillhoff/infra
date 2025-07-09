import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { createM365DnsRecords } from "./m365-dns";

export interface DnsArgs {
  domain: pulumi.Input<string>;
  cloudflareZoneId: pulumi.Input<string>;

  // Enable M365 DNS records
  m365Dns?: pulumi.Input<boolean>;

  // Google site verification, e.g. google-site-verification=2HI_asdfyFCcasdfrH1IasdfhesDasdf35pVasdfQvg
  googleSiteVerification?: pulumi.Input<string>;

  // Bluesky verification, e.g. did:plc:asdfvq4oasdf5gtdasdfuenw
  blueskyVerification?: pulumi.Input<string>;
}

export class Dns extends pulumi.ComponentResource {
  constructor(
    name: string,
    props: DnsArgs,
    opts: pulumi.ComponentResourceOptions,
  ) {
    super("dns-component:index:Dns", name, {}, opts);

    // new cloudflare.DnsRecord(`caa-letsencrypt`, {
    //   name: props.domain,
    //   type: "CAA",
    //   ttl: 3600,
    //   content: 'CAA 0 issue "letsencrypt.org"',
    //   zoneId: props.cloudflareZoneId,
    // });

    new cloudflare.DnsRecord(`www-cname`, {
      name: "www",
      type: "CNAME",
      ttl: 600,
      content: props.domain,
      zoneId: props.cloudflareZoneId,
    });

    if (props.m365Dns) {
      createM365DnsRecords({
        domain: props.domain,
        cloudflareZoneId: props.cloudflareZoneId,
      });
    }

    if (props.googleSiteVerification) {
      new cloudflare.DnsRecord(`google-site-verification`, {
        name: props.domain,
        type: "TXT",
        ttl: 3600,
        content: `"google-site-verification=${props.googleSiteVerification}"`,
        zoneId: props.cloudflareZoneId,
      });
    }

    if (props.blueskyVerification) {
      new cloudflare.DnsRecord(`bluesky-verification`, {
        name: `_atproto.${props.domain}`,
        type: "TXT",
        ttl: 3600,
        content: `"did=${props.blueskyVerification}"`,
        zoneId: props.cloudflareZoneId,
      });
    }
  }
}
