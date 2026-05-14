#!/usr/bin/env python3

import json
import sys
import traceback
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).parent))

WORKDIR = Path("/data")
DEBUG_LOG = WORKDIR / "plugin-debug.log"


class _Tee:
    """Mirrors writes to real stdout and a log file so every line is captured."""
    def __init__(self, stream, log_file):
        self._stream = stream
        self._log = log_file

    def write(self, data):
        self._stream.write(data)
        self._stream.flush()
        try:
            self._log.write(data)
            self._log.flush()
        except OSError:
            pass

    def flush(self):
        self._stream.flush()

    # Delegate attribute access (e.g. .encoding, .fileno) to the real stream.
    def __getattr__(self, name):
        return getattr(self._stream, name)


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
    print(f"ApiKey present: {bool(api_key)}", flush=True)

    if not check_tools_available():
        raise RuntimeError("ffmpeg or ffprobe not found in PATH")

    print("Fetching scene list from Stash...", flush=True)
    paths = get_all_scene_paths(server_url, api_key)

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
    print(json.dumps({"output": summary, "error": None}), flush=True)


if __name__ == "__main__":
    log_f = open(DEBUG_LOG, "w")
    sys.stdout = _Tee(sys.__stdout__, log_f)
    sys.stderr = _Tee(sys.__stderr__, log_f)
    try:
        from script import process_file, Statistics, check_tools_available
        main()
    except Exception:
        tb = traceback.format_exc()
        print(tb, flush=True)
        print(json.dumps({"output": None, "error": tb}), flush=True)
    finally:
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__
        log_f.close()
