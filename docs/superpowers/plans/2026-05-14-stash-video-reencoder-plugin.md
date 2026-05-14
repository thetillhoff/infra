# Stash Video Re-encoder Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stash task plugin that re-encodes videos from the Stash UI, reusing core logic from the existing standalone script.

**Architecture:** A new `stash_plugin.py` in a dedicated plugin directory imports `process_file()` and helpers from a co-located copy of `script.py`. The Stash Docker image is extended with Python3. Ansible deploys the plugin files into the Stash config volume.

**Tech Stack:** Python 3, Stash raw plugin interface, Stash GraphQL API (`urllib` — no external deps), Ansible `copy` module, Alpine `apk`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `ansible/roles/stash/files/Dockerfile` | Extends stash image with Python3 |
| Modify | `ansible/roles/stash/files/docker-compose.yml` | Switch from `image:` to `build:` |
| Modify | `ansible/roles/stash/tasks/main.yml` | Add plugin file deployment + `build: always` |
| Create | `ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.yml` | Stash plugin descriptor |
| Create | `ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.py` | Stash entry point |
| Create | `ansible/roles/stash/files/plugins/video-reencoder/script.py` | Copy of standalone script (kept in sync manually) |
| Create | `ansible/roles/stash/files/plugins/video-reencoder/test_stash_plugin.py` | Unit tests for plugin entry point |

> **Note:** `script.py` is duplicated, not shared. Both copies must remain independently runnable. When updating the standalone script, copy the changes here too.

---

## Task 1: Extend Stash Docker Image with Python3

The `stashapp/stash` image is Alpine-based and does not include Python3. The plugin runs as a subprocess inside the container, so Python must be present.

**Files:**
- Create: `ansible/roles/stash/files/Dockerfile`
- Modify: `ansible/roles/stash/files/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

`ansible/roles/stash/files/Dockerfile`:
```dockerfile
FROM stashapp/stash:v0.31.1@sha256:df744af5a0c976e2ec671052ecc1f8a9aa757fa12b8f9930b59910b7295f0da6
RUN apk add --no-cache python3
```

- [ ] **Step 2: Switch docker-compose.yml from image to build**

In `ansible/roles/stash/files/docker-compose.yml`, replace:
```yaml
    image: stashapp/stash:v0.31.1@sha256:df744af5a0c976e2ec671052ecc1f8a9aa757fa12b8f9930b59910b7295f0da6
```
with:
```yaml
    build:
      context: .
      dockerfile: Dockerfile
```

- [ ] **Step 3: Verify Python is available in the built image**

```bash
cd ansible/roles/stash/files
docker build -t stash-with-python .
docker run --rm stash-with-python python3 --version
```
Expected output: `Python 3.x.x`

- [ ] **Step 4: Commit**

```bash
git add ansible/roles/stash/files/Dockerfile ansible/roles/stash/files/docker-compose.yml
git commit -m "feat: extend stash image with python3 for plugin support"
```

---

## Task 2: Create Plugin Descriptor

**Files:**
- Create: `ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.yml`

- [ ] **Step 1: Create plugin directory and descriptor**

`ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.yml`:
```yaml
name: Video Re-encoder
description: Re-encodes videos to h264 with bitrate-aware rate control. Downscales to 1080p if needed. Replaces the original with the output only when the output is smaller.
version: 0.1.0
exec:
  - python3
  - stash_plugin.py
interface: raw
tasks:
  - name: Re-encode all videos
    description: Fetches all scenes from the Stash library and re-encodes each video file. Progress and results are shown in the task log. Run a library scan afterwards to update file metadata in Stash.
```

- [ ] **Step 2: Commit**

```bash
git add ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.yml
git commit -m "feat: add stash plugin descriptor for video re-encoder"
```

---

## Task 3: Create Plugin Entry Point

The plugin reads Stash's `PluginInput` JSON from stdin, fetches all scene file paths via GraphQL, then calls `process_file()` from `script.py` for each one. Progress is printed to stdout (Stash shows it in the task log). The final line of stdout is a `PluginOutput` JSON that Stash parses for the task result.

**Files:**
- Create: `ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.py`
- Create: `ansible/roles/stash/files/plugins/video-reencoder/test_stash_plugin.py`

- [ ] **Step 1: Write failing tests**

`ansible/roles/stash/files/plugins/video-reencoder/test_stash_plugin.py`:
```python
import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import stash_plugin


def test_build_server_url_http():
    server = {"Scheme": "http", "Host": "localhost", "Port": 9999}
    assert stash_plugin.build_server_url(server) == "http://localhost:9999"


def test_build_server_url_https():
    server = {"Scheme": "https", "Host": "stash.example.com", "Port": 443}
    assert stash_plugin.build_server_url(server) == "https://stash.example.com:443"


def test_read_plugin_input():
    sample = json.dumps({
        "server_connection": {
            "Scheme": "http", "Host": "localhost", "Port": 9999, "ApiKey": "test-key"
        },
        "args": {}
    })
    with patch("sys.stdin", io.StringIO(sample)):
        result = stash_plugin.read_plugin_input()
    assert result["server_connection"]["ApiKey"] == "test-key"
    assert result["server_connection"]["Port"] == 9999


def test_get_all_scene_paths_extracts_paths():
    mock_response = {
        "data": {
            "findScenes": {
                "scenes": [
                    {"id": "1", "files": [{"path": "/data/video1.mp4"}]},
                    {"id": "2", "files": [{"path": "/data/video2.mkv"}]},
                ]
            }
        }
    }
    with patch("stash_plugin.graphql_query", return_value=mock_response):
        paths = stash_plugin.get_all_scene_paths("http://localhost:9999", "key")
    assert paths == ["/data/video1.mp4", "/data/video2.mkv"]


def test_get_all_scene_paths_handles_empty():
    mock_response = {"data": {"findScenes": {"scenes": []}}}
    with patch("stash_plugin.graphql_query", return_value=mock_response):
        paths = stash_plugin.get_all_scene_paths("http://localhost:9999", "key")
    assert paths == []


def test_get_all_scene_paths_handles_multiple_files_per_scene():
    mock_response = {
        "data": {
            "findScenes": {
                "scenes": [
                    {"id": "1", "files": [
                        {"path": "/data/a.mp4"},
                        {"path": "/data/b.mp4"},
                    ]},
                ]
            }
        }
    }
    with patch("stash_plugin.graphql_query", return_value=mock_response):
        paths = stash_plugin.get_all_scene_paths("http://localhost:9999", "key")
    assert paths == ["/data/a.mp4", "/data/b.mp4"]
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd ansible/roles/stash/files/plugins/video-reencoder
python3 -m pytest test_stash_plugin.py -v
```
Expected: `ModuleNotFoundError: No module named 'stash_plugin'`

- [ ] **Step 3: Create stash_plugin.py**

`ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.py`:
```python
#!/usr/bin/env python3

import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).parent))
from script import process_file, Statistics, check_tools_available

WORKDIR = Path("/data")


def read_plugin_input() -> dict:
    return json.loads(sys.stdin.read())


def build_server_url(server: dict) -> str:
    scheme = server.get("Scheme", "http")
    host = server.get("Host", "localhost")
    port = server.get("Port", 9999)
    return f"{scheme}://{host}:{port}"


def graphql_query(server_url: str, api_key: str, query: str, variables: dict = None) -> dict:
    url = f"{server_url}/graphql"
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "ApiKey": api_key},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def get_all_scene_paths(server_url: str, api_key: str) -> List[str]:
    query = """
    query {
        findScenes(filter: { per_page: -1 }) {
            scenes {
                id
                files {
                    path
                }
            }
        }
    }
    """
    result = graphql_query(server_url, api_key, query)
    paths = []
    for scene in result["data"]["findScenes"]["scenes"]:
        for f in scene.get("files", []):
            paths.append(f["path"])
    return paths


def main() -> None:
    plugin_input = read_plugin_input()
    server = plugin_input["server_connection"]
    server_url = build_server_url(server)
    api_key = server.get("ApiKey", "")

    print(f"Connecting to Stash at {server_url}", flush=True)

    if not check_tools_available():
        print(json.dumps({"output": None, "error": "ffmpeg or ffprobe not found in PATH"}))
        sys.exit(1)

    print("Fetching scene list from Stash...", flush=True)
    try:
        paths = get_all_scene_paths(server_url, api_key)
    except Exception as e:
        print(json.dumps({"output": None, "error": f"Failed to fetch scenes: {e}"}))
        sys.exit(1)

    print(f"Found {len(paths)} scene files", flush=True)

    stats = Statistics()
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    corrupted_report = WORKDIR / f"corrupted-video-files-{timestamp}.txt"

    for path in paths:
        process_file(Path(path), WORKDIR, stats, corrupted_report)

    summary = str(stats)
    print(f"\n{summary}", flush=True)

    if corrupted_report.exists():
        print(f"Corrupted files report: {corrupted_report}", flush=True)

    # Must be the last line — Stash parses this as PluginOutput
    print(json.dumps({"output": summary, "error": None}))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd ansible/roles/stash/files/plugins/video-reencoder
python3 -m pytest test_stash_plugin.py -v
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add ansible/roles/stash/files/plugins/video-reencoder/stash_plugin.py \
        ansible/roles/stash/files/plugins/video-reencoder/test_stash_plugin.py
git commit -m "feat: add stash plugin entry point for video re-encoder"
```

---

## Task 4: Copy script.py to Plugin Directory

The plugin imports from `script.py` at runtime inside the container. The file must exist alongside `stash_plugin.py` in the plugin directory.

**Files:**
- Create: `ansible/roles/stash/files/plugins/video-reencoder/script.py`

- [ ] **Step 1: Copy script.py**

```bash
cp ansible/roles/fileserver-blackhole/files/video-management/script.py \
   ansible/roles/stash/files/plugins/video-reencoder/script.py
```

- [ ] **Step 2: Verify the import works locally**

```bash
cd ansible/roles/stash/files/plugins/video-reencoder
python3 -c "from script import process_file, Statistics, check_tools_available; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ansible/roles/stash/files/plugins/video-reencoder/script.py
git commit -m "chore: add script.py copy to stash plugin directory"
```

---

## Task 5: Deploy Plugin via Ansible

Ansible must copy the plugin files into the Stash config volume at `/mnt/hot/stash/config/plugins/video-reencoder/` and rebuild the Docker image.

**Files:**
- Modify: `ansible/roles/stash/tasks/main.yml`

- [ ] **Step 1: Update Ansible tasks**

Replace the contents of `ansible/roles/stash/tasks/main.yml` with:
```yaml
- name: Create stash plugin directory for video re-encoder
  file:
    path: /mnt/hot/stash/config/plugins/video-reencoder
    state: directory
    mode: '0755'

- name: Deploy video re-encoder plugin files
  copy:
    src: "plugins/video-reencoder/"
    dest: /mnt/hot/stash/config/plugins/video-reencoder/
    mode: '0755'

# Start container — build: always ensures the Python3 layer is present
- community.docker.docker_compose_v2:
    project_src: "./infra/ansible/roles/{{ role_path | basename }}/files/"
    remove_orphans: true
    build: always
```

- [ ] **Step 2: Verify plugin files are deployed (dry run)**

```bash
ansible-playbook ansible/blackhole.yaml --tags stash --check -v
```
Expected: tasks show "changed" for file creation and copy, no errors.

- [ ] **Step 3: Commit**

```bash
git add ansible/roles/stash/tasks/main.yml
git commit -m "feat: deploy video re-encoder plugin via ansible"
```

---

## Task 6: End-to-End Test

Manual verification that the plugin appears and runs in Stash.

- [ ] **Step 1: Run the Ansible playbook against the target host**

```bash
ansible-playbook ansible/blackhole.yaml --tags stash
```

- [ ] **Step 2: Verify plugin is visible in Stash UI**

Open Stash → Settings → Tasks. The "Video Re-encoder" section with a "Re-encode all videos" task should be listed.

- [ ] **Step 3: Run the task on a small test scene**

Before running on the full library: in Stash → Settings → Library, temporarily set the library path to a folder with one test file. Run the task. Check the task log for progress output and confirm the file was processed (or skipped, if already h264 ≤1080p).

- [ ] **Step 4: Run a library scan after re-encoding**

After the task completes, go to Stash → Settings → Tasks → Scan and run a library scan. This updates Stash's database with the new file paths/sizes for any replaced files.

- [ ] **Step 5: Verify standalone script still works**

```bash
cd ansible/roles/fileserver-blackhole/files/video-management
python3 script.py --help
```
Expected: usage message printed, no errors.
