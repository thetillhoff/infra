# Set up magic mirror on Raspberry Pi 3B

## Flash SD card

- Flash it with raspberry pi os lite - no gui at all (so there is no bloatware later).

- Create a file in boot partition called `ssh`

- Add the following line at the end of `/boot/firmware/cmdline.txt`:

```text
fbcon=rotate:3
```

- Add the following line at the end of `/boot/firmware/config.txt`:

```text
disable_splash=1
```

## Boot raspberry pi

Do the initial setup (keyboard, user, password).

## Configure SSH

```sh
mkdir -m 700 ~/.ssh
curl https://github.com/thetillhoff.keys > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

sudo apt-get install vim -y
# disable PasswordAuthentication in /etc/ssh/sshd_config
sudo systemctl restart sshd

sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get autoremove -y && sudo apt-get clean

sudo raspi-config nonint do_hostname <hostname>
sudo raspi-config nonint do_wifi_country DE
sudo raspi-config nonint do_wifi_ssid_passphrase "<ssid>" "<passphrase>"

# autologin is not needed as we use loginctl enable-linger later

# sudo raspi-config nonint do_boot_behaviour B4 #autologin graphic

# sudo raspi-config nonint do_boot_splash 1 #disable
#   already done during flash

# sudo raspi-config nonint do_blanking 1 #disable

sudo apt-get install -y labwc seatd wlr-randr chromium
sudo groupadd seat
sudo usermod -aG seat $USER

## Configure screen rotation

mkdir -p ~/.config/labwc/
vim ~/.config/labwc/autostart
```sh
# ~/.config/labwc/autostart
wlr-randr --output HDMI-A-1 --transform 90 &
```

## Verify labwc & configure its autostart

- Run `dbus-run-session labwc -m` or `labwc -m` (config merge mode (system and user level)) from console manually to verify.

- If it works, add the autostart:

```sh
mkdir -p ~/.config/systemd/user/
vim ~/.config/systemd/user/labwc.service
```

```text
[Unit]
Description=labwc wayland compositor
After=default.target

[Service]
ExecStart=/usr/bin/labwc
Restart=always

[Install]
WantedBy=default.target
```

- Configure autostart

```sh
systemctl --user daemon-reload
systemctl --user enable labwc.service
# disable tty on console 1, enable tty on console 2
sudo systemctl disable getty@tty1.service
sudo systemctl enable getty@tty2.service
loginctl enable-linger $USER # critical to allow user services to start without a tty login
```

- Verify labwc starts after a reboot automatically (blank screen with cursor).

## Install Docker

- Install Docker according to <https://docs.docker.com/engine/install/debian/#install-using-the-repository> or run the convenience script:

```sh
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh
```

- Either way, run:

```sh
sudo groupadd docker # might already exist
sudo usermod -aG docker $USER
```

```sh
vim /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

- Then log out and log in again to activate the group membership.

- Verify docker works with:

```sh
docker run -dp 8080:80 --rm nginx:alpine
# `DISPLAY=:0` is critical to run chromium in the correct display when running it via SSH.
DISPLAY=:0 chromium --kiosk --incognito http://localhost:8080/
# cleanup
docker stop $(docker ps -aq)
docker image prune -af
```

## Add container & chromium to autostart

```sh
vim ~/.config/labwc/autostart
```

```sh
# ~/.config/labwc/autostart
wlr-randr --output HDMI-A-1 --transform 90 &
docker run -dp 8080:80 --restart=always nginx:alpine
chromium --kiosk \
  # --ozone-platform=wayland \
  # --enable-features=UseOzonePlatform \
  --incognito \
  # --disable-gpu \
  # --disable-software-rasterizer \
  # --noerrdialogs \
  # --enable-features=UseOzonePlatform \
  # --ozone-platform=wayland \
  # --no-first-run \
  # --disable-session-crashed-bubble \
  http://localhost:8080/
```

<!-- # chromium --disable-gpu --kiosk https://localhost:8080/
# DISPLAY=:0 chromium --kiosk --disable-gpu --disable-software-rasterizer --noerrdialogs http://localhost:8080/
# --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar --start-maximized & -->

Verify container & chromium by rebooting.

## Set up MagicMirror via docker

```sh
docker stop $(docker ps -aq)

mkdir -p ~/magic-mirror/config/
mkdir -p ~/magic-mirror/modules/

vim ~/magic-mirror/config/config.js
```

```js
let config = {
  address: '0.0.0.0', // Listen on all interfaces (required for Docker)
  port: 8080,
  ipWhitelist: ['127.0.0.0/8','172.0.0.0/8'], // Allow connections from local IP & docker
  language: 'de',
  modules: [
    {
      module: 'clock',
      position: 'top_left',
    },
    {
      module: 'calendar',
      header: 'Feiertage Hamburg',
      position: 'top_left',
      config: {
        calendars: [
          {
            fetchInterval: 7 * 24 * 60 * 60 * 1000,
            symbol: 'calendar-check',
            url: 'https://ics.tools/Feiertage/hamburg.ics',
          },
        ],
      },
    },
    {
      module: 'compliments',
      position: 'lower_third',
      lang: 'en',
    },
    {
      module: 'weather',
      position: 'top_right',
      header: 'Aktuelles Wetter',
      lang: 'de',
      config: {
        weatherProvider: 'openmeteo',
        type: 'current',
        lat: 53.58,
        lon: 10.13,
      },
    },
    {
      module: 'weather',
      position: 'top_right',
      header: 'Wettervorhersage',
      lang: 'de',
      config: {
        weatherProvider: 'openmeteo',
        type: 'forecast',
        lat: 53.58,
        lon: 10.13,
      },
    },
  ],
};
/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config;
}
```

- Then configure the magic mirror docker container via docker-compose:

```sh
vim ~/docker-compose.yml
```

```yaml
services:
  magicmirror:
    # image: bastilimbach/docker-magicmirror
    image: karsten13/magicmirror:v2.34.0_alpine
    container_name: magicmirror
    restart: unless-stopped
    environment:
      TZ: Europe/Berlin
      MM_SCENARIO: 'server'
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - ~/magic-mirror/config:/opt/magic_mirror/config
      - ~/magic-mirror/modules:/opt/magic_mirror/modules
    ports:
      - 8080:8080
```

- Do the first start manually with `docker compose up`, so the image is pulled.

- Change the docker command in `~/.config/labwc/autostart` to:

```sh
docker compose up -d --wait
```

<!-- odoo/odoo/pull/219232
apt-get install wtype?
~/.config/labwc/autostart
add
wtype -M alt -M logo h -m alt -m logo
~/.config/labwc/rc.xml
add
config from odoo/odoo/pull/219232
HideCursor and WarpCursor to -1,-1
swaybg -c '#000000' $

sudo raspi-config nonint do_update #update this tool -->

## Set read-only mode on SD card

Sadly, a readonly overlayfs is not possible. MagicMirror needs several files/folders to be writable. We could get there with our own custom docker image, but that's a bit overkill for now.

## Reboot to apply & verify everything works

```sh
sudo systemctl reboot
```

That's it!
