# thetillhoff-de

## Umami website id

`fetch-website-id.sh` runs as init container. It reads the id of the website `thetillhoff.de` from the umami API and writes it to `/config/config.env`. The site container takes `UMAMI_WEBSITE_ID` from that file with `fileKeyRef`.

- The `umami-reader` user is view-only. `/api/websites` lists only websites it owns. The script uses the team endpoints instead. The website must stay in the `everyone` team.
- The script exits 0 on any error. The pod then starts without the id, and the page loads without tracking.
- Running pods keep an old id after a reset of the umami database. Run `kubectl rollout restart deployment/thetillhoff-de`.
- The umami UI is at `analytics.internal.thetillhoff.de`. Only `/script.js` and `/api/send` are public.
