# Home Assistant setup

Runs on a Raspberry Pi with **Home Assistant OS**.

## Caddy2 reverse proxy

Provided by the [app-caddy-2](https://github.com/einschmidt/app-caddy-2) add-on.

### Caddyfile location

- From the OS / SSH shell: `/addon_configs/c80c7555_caddy-2/Caddyfile`
- From the terminal add-on in the Home Assistant web UI: `~/addon_configs/c80c7555_caddy-2/Caddyfile`

### Caddyfile

```caddyfile
{
 # Caddy failed to start on Home Assistant OS with local CA trust
 # installation enabled, so skip it.
 skip_install_trust
}

homeassistant.local, homeassistant.lan, https://192.168.1.254 {
 reverse_proxy homeassistant:8123
 tls_internal
}
```

## Host access

Connect a monitor + keyboard to the Pi:

- `login` - drop into a proper root terminal.
- `host reboot` - restart the whole system.
