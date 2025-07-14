import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

interface M365DnsArgs {
  domain: pulumi.Input<string>;
  cloudflareZoneId: pulumi.Input<string>;
}

export function createM365DnsRecords(args: M365DnsArgs) {
  const domainWithDashes = pulumi
    .output(args.domain)
    .apply((domain) => domain.replace(/\./g, "-"));

  new cloudflare.DnsRecord("mx-record", {
    name: args.domain,
    type: "MX",
    ttl: 3600,
    priority: 10,
    content: pulumi.interpolate`${domainWithDashes}.mail.protection.outlook.com`,
    zoneId: args.cloudflareZoneId,
  });

  new cloudflare.DnsRecord("autodiscover-cname-record", {
    name: "autodiscover",
    type: "CNAME",
    ttl: 3600,
    content: "autodiscover.outlook.com",
    zoneId: args.cloudflareZoneId,
  });

  new cloudflare.DnsRecord("spf-txt-record", {
    name: args.domain,
    type: "TXT",
    ttl: 3600,
    content: `"v=spf1 include:spf.protection.outlook.com -all"`,
    zoneId: args.cloudflareZoneId,
  });

  new cloudflare.DnsRecord("dkim1-cname-record", {
    name: `selector1._domainkey.${args.domain}`,
    type: "CNAME",
    ttl: 3600,
    content: `selector1-${args.domain}._domainkey.${args.domain}.onmicrosoft.com`,
    zoneId: args.cloudflareZoneId,
  });

  new cloudflare.DnsRecord("dkim2-cname-record", {
    name: `selector2._domainkey.${args.domain}`,
    type: "CNAME",
    ttl: 3600,
    content: `selector2-${args.domain}._domainkey.${args.domain}.onmicrosoft.com`,
    zoneId: args.cloudflareZoneId,
  });
}
