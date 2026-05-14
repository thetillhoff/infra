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
