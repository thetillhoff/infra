# manga-scraper

Postgres, api and ui. A migrations init container applies the schema. The atlas image is built by the CI of the manga-scraper repo, so the database follows the image.

- The UI is only at `manga.internal.thetillhoff.de`. Its unauthenticated buttons start crawls. A public route would let anyone drive the headed Chromium of the cluster at third-party sites.
- The api runs Chromium. It runs as one replica, because the crawl lock per source is in the process. Limits: 1.5Gi memory, 256Mi `/dev/shm`, and a ResourceQuota in the namespace.
- Api and ui roll with `maxUnavailable: 0`: the reader keeps the old pod until the new pod passes its probe.
- The page-store PVC of the api is ReadWriteOnce, so its pods prefer one node. A surged pod on another node waits on a multi-attach error while the old pod serves.
