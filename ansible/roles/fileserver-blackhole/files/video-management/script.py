#!/usr/bin/env python3

import argparse
import json
import os
import signal
import shutil
import subprocess
import sys
from datetime import datetime
from enum import IntEnum
from pathlib import Path
from time import time
from typing import List, Optional, Tuple

# Constants
DEFAULT_WORKDIR = Path("/data")
MAX_HEIGHT = 1080
MAX_FPS = 30
QUALITY_VALUE = 28  # HEVC VA-API CQP quality; lower = better (roughly equivalent to H.265 CRF 28)
VAAPI_DEVICE = "/dev/dri/renderD128"
TARGET_CODEC = "hevc"
MAX_FILENAME_LEN = 255
# If the converted file is smaller than this fraction of the original, treat it as suspicious.
MIN_OUTPUT_SIZE_RATIO = 0.20

# Supported file extensions
# mp4 is a special case: only converted if it needs downscaling, codec change, or fps reduction.
SUPPORTED_EXTENSIONS = {"mp4", "avi", "flv", "mkv", "mov", "mpg", "rmvb", "webm", "wmv"}

# ---------------------------------------------------------------------------
# Graceful shutdown state
# ---------------------------------------------------------------------------
_shutdown_requested = False
_current_process: Optional[subprocess.Popen] = None
_current_temp_path: Optional[Path] = None
_in_critical_section = False


def _handle_shutdown(signum, frame):
    global _shutdown_requested
    _shutdown_requested = True
    print("\nShutdown requested, finishing current operation...", file=sys.stderr)
    proc = _current_process
    # Kill the ffmpeg process unless we are in the middle of an atomic replace.
    if proc is not None and not _in_critical_section:
        proc.terminate()


signal.signal(signal.SIGTERM, _handle_shutdown)
signal.signal(signal.SIGINT, _handle_shutdown)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

class ProcessResult(IntEnum):
    """Return codes for file processing."""
    SUCCESS = 0
    SKIPPED = 1
    FAILED = 2


class Statistics:
    """Track processing statistics."""
    def __init__(self):
        self.processed = 0
        self.skipped = 0
        self.failed = 0

    def __str__(self):
        return (
            f"Files processed: {self.processed}\n"
            f"Files skipped: {self.skipped}\n"
            f"Files failed: {self.failed}"
        )


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def check_tools_available() -> bool:
    """Check if ffmpeg and ffprobe are available."""
    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg not found in PATH", file=sys.stderr)
        return False
    if not shutil.which("ffprobe"):
        print("Error: ffprobe not found in PATH", file=sys.stderr)
        return False
    return True


def parse_fps(fps_str: Optional[str]) -> Optional[float]:
    """Parse a frame rate string like '60/1' or '30000/1001' to a float."""
    if not fps_str:
        return None
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/", 1)
            den_int = int(den)
            if den_int == 0:
                return None
            return int(num) / den_int
        return float(fps_str)
    except (ValueError, ZeroDivisionError):
        return None


def get_video_info(file_path: Path) -> Tuple[Optional[str], Optional[int], Optional[str], Optional[int], Optional[float], Optional[str]]:
    """Get video information using ffprobe.

    Returns:
        Tuple of (codec_name, height, pix_fmt, bitrate, fps, error_message)
        If successful, error_message is None. Otherwise, other values are None.
        Bitrate is in bits per second. Derived from stream metadata when available,
        otherwise computed from file size / duration as a fallback.
        fps is frames per second, or None if not available.
    """
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,height,pix_fmt,bit_rate,r_frame_rate:format=duration",
            "-of", "json",
            str(file_path)
        ]

        start_time = time()
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        elapsed = int(time() - start_time)
        if elapsed > 1:
            print(f"FFPROBE DURATION: {elapsed}s")

        data = json.loads(result.stdout)
        stream = data.get("streams", [{}])[0]
        fmt = data.get("format", {})

        codec_name = stream.get("codec_name", "")
        height = stream.get("height")
        pix_fmt = stream.get("pix_fmt", "")
        bitrate = stream.get("bit_rate")
        fps = parse_fps(stream.get("r_frame_rate"))

        if height is not None and not isinstance(height, int):
            try:
                height = int(height)
            except (ValueError, TypeError):
                return None, None, None, None, None, f"Invalid height value: {height}"

        if bitrate is not None:
            try:
                bitrate = int(bitrate)
            except (ValueError, TypeError):
                bitrate = None

        # Fallback: derive bitrate from file size and duration (works for any container).
        # Some formats (MKV, WebM) don't embed per-stream bitrate in metadata.
        if bitrate is None:
            try:
                file_duration = float(fmt.get("duration", 0))
                if file_duration > 0:
                    bitrate = int(file_path.stat().st_size * 8 / file_duration)
            except (ValueError, TypeError, OSError) as e:
                return None, None, None, None, None, f"Could not compute fallback bitrate for: {file_path}\nError: {e}"

        if bitrate is None:
            return None, None, None, None, None, f"Could not determine bitrate for: {file_path}"

        return codec_name, height, pix_fmt, bitrate, fps, None
    except subprocess.CalledProcessError as e:
        return None, None, None, None, None, f"FFprobe failed to analyze file: {file_path} (exit code: {e.returncode})\nError: {e.stderr}"
    except json.JSONDecodeError:
        return None, None, None, None, None, f"Could not parse video information for: {file_path}"
    except Exception as e:
        return None, None, None, None, None, f"Unexpected error analyzing file: {file_path}\nError: {str(e)}"


def get_file_size(file_path: Path) -> Optional[int]:
    """Get file size in bytes."""
    try:
        return file_path.stat().st_size
    except OSError:
        return None


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f}PB"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_file(file_path: Path) -> Tuple[Optional[Path], ProcessResult]:
    """Validate that file exists and is a regular file."""
    file_path = Path(file_path)
    if not file_path.is_file():
        print(f"Not a file: {file_path}", file=sys.stderr)
        return None, ProcessResult.FAILED
    return file_path, ProcessResult.SUCCESS


def validate_extension(file_path: Path) -> Tuple[Optional[str], ProcessResult]:
    """Validate that file extension is supported."""
    extension = file_path.suffix.lstrip('.').lower()
    if extension not in SUPPORTED_EXTENSIONS:
        print(f"Skipping unsupported file: {file_path} (extension: {extension})")
        return None, ProcessResult.SKIPPED
    return extension, ProcessResult.SUCCESS


def validate_video_info(
    file_path: Path,
    codec_name: Optional[str],
    height: Optional[int],
    pix_fmt: Optional[str],
    bitrate: Optional[int],
    fps: Optional[float],
    error: Optional[str],
) -> Tuple[Optional[Tuple[str, int, str, Optional[int], Optional[float]]], ProcessResult]:
    """Validate video information from ffprobe."""
    if error:
        print(f"  {error}", file=sys.stderr)
        return None, ProcessResult.FAILED

    if not codec_name or height is None or not pix_fmt:
        print(f"  Could not parse video information for: {file_path}", file=sys.stderr)
        return None, ProcessResult.FAILED

    return (codec_name, height, pix_fmt, bitrate, fps), ProcessResult.SUCCESS


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def get_temp_path(file_path: Path) -> Path:
    """Return the in-progress transcode path. Dot-prefixed so it is hidden."""
    return file_path.parent / f".{file_path.stem}.transcode.tmp.mp4"


def get_final_path(file_path: Path, extension: str) -> Path:
    """Return the final output path. For mp4 sources, replaces the original in-place."""
    if extension == "mp4":
        return file_path
    return file_path.parent / f"{file_path.stem}.mp4"


# ---------------------------------------------------------------------------
# Encoding logic
# ---------------------------------------------------------------------------

def estimate_output_size_increase(codec_name: str, height: int, bitrate: Optional[int],
                                   file_size: int) -> Optional[bool]:
    """Estimate if output file will be larger than input.

    Returns:
        True if output is estimated to be larger, False if smaller, None if cannot estimate.
    """
    if bitrate is None:
        if codec_name in ("hevc", "h265"):
            return True  # Already HEVC; re-encoding adds generation loss without savings
        if codec_name == "av1":
            return True  # AV1 is more efficient than HEVC; converting would increase size
        if codec_name == "h264" and height <= MAX_HEIGHT:
            return False  # H.264 → HEVC saves ~40% at equivalent quality
        return False

    # Estimate target bitrate for HEVC at CQP 28 (~60% of H.264 CRF 23 at equivalent quality)
    if height > 1080:
        estimated_target_bitrate = 2_500_000  # ~2.5 Mbps for 1080p HEVC
    elif height > 720:
        estimated_target_bitrate = 2_200_000
    elif height > 480:
        estimated_target_bitrate = 1_500_000
    else:
        estimated_target_bitrate = 900_000

    if codec_name in ("hevc", "h265"):
        # Already HEVC; re-encoding at same settings adds overhead
        estimated_target_bitrate = int(bitrate * 1.1)
    elif codec_name == "av1":
        # AV1 is more efficient than HEVC; HEVC output will need more bits
        estimated_target_bitrate = int(estimated_target_bitrate * 1.15)
    # h264 and other less-efficient codecs: no adjustment needed

    return bitrate < estimated_target_bitrate


def should_skip_mp4(extension: str, height: int, codec_name: str, pix_fmt: str, fps: Optional[float]) -> bool:
    """Check if MP4 file is already in desired format."""
    if not (extension == "mp4" and height <= MAX_HEIGHT and codec_name == TARGET_CODEC):
        return False
    if fps is not None and fps > MAX_FPS:
        return False
    return True


def build_ffmpeg_flags(height: int, fps: Optional[float]) -> List[str]:
    """Build ffmpeg output flags for AV1 VA-API hardware encoding.

    Software filters (fps) run before hwupload; hardware filters (scale_vaapi) run after.
    The -vaapi_device global option is added in convert_video before -i.
    """
    vf_filters = []
    if fps is not None and fps > MAX_FPS:
        vf_filters.append(f"fps={MAX_FPS}")
    vf_filters.extend(["format=nv12", "hwupload"])
    if height > MAX_HEIGHT:
        vf_filters.append(f"scale_vaapi=-2:{MAX_HEIGHT}")

    return [
        "-c:v", "hevc_vaapi",
        "-rc_mode", "CQP",
        "-global_quality", str(QUALITY_VALUE),
        "-vf", ",".join(vf_filters),
        "-hide_banner",
        "-loglevel", "error",
    ]


# ---------------------------------------------------------------------------
# Corruption checking
# ---------------------------------------------------------------------------

def check_file_corruption(file_path: Path, extension: str) -> bool:
    """Check if a video file appears corrupted.

    For MP4/MOV files, verifies the presence of the 'ftyp' ISO base-media atom in
    the first 64 bytes. Then runs a full ffprobe validation for all formats.

    Returns True if the file appears corrupted, False otherwise.
    """
    if extension in ("mp4", "mov"):
        try:
            with open(file_path, "rb") as f:
                header = f.read(64)
            if b"ftyp" not in header:
                print(f"  Corrupted (invalid header, 'ftyp' atom not found): {file_path}", file=sys.stderr)
                return True
        except OSError as e:
            print(f"  Could not read file header: {file_path}: {e}", file=sys.stderr)
            return True

    try:
        subprocess.run(
            ["ffprobe", "-v", "error", "-show_format", "-show_streams", str(file_path)],
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        print(f"  Corrupted (ffprobe validation failed): {file_path}", file=sys.stderr)
        return True

    return False


# ---------------------------------------------------------------------------
# Graceful-shutdown-aware ffmpeg execution and file replacement
# ---------------------------------------------------------------------------

def _run_ffmpeg(cmd: List[str]) -> Tuple[bool, str]:
    """Run an ffmpeg command, registering the process for graceful shutdown."""
    global _current_process
    try:
        proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL)
        _current_process = proc
        _, stderr_bytes = proc.communicate()
        _current_process = None
        if proc.returncode != 0:
            err = stderr_bytes.decode(errors="replace").strip() if stderr_bytes else ""
            return False, err
        return True, ""
    except OSError as e:
        _current_process = None
        return False, str(e)


def _critical_replace(temp_path: Path, target_path: Path) -> None:
    """Atomically replace target with temp. Always runs to completion, even during shutdown."""
    global _in_critical_section
    _in_critical_section = True
    try:
        os.replace(str(temp_path), str(target_path))
    finally:
        _in_critical_section = False


def finalize_output(original_path: Path, temp_path: Path, final_path: Path) -> None:
    """Validate the temp file, compare sizes, then atomically replace or discard.

    If temp is smaller: replace original atomically (critical section), then remove
    the original source file if it differs from final_path (non-mp4 sources).
    If temp is not smaller: discard temp, keep original unchanged.
    """
    original_size = get_file_size(original_path)
    temp_size = get_file_size(temp_path)
    if original_size is None or temp_size is None:
        temp_path.unlink(missing_ok=True)
        return

    codec_name, height, pix_fmt, _, _fps, error = get_video_info(temp_path)
    if error or not codec_name or height is None or not pix_fmt:
        print(
            f"  Converted file invalid, discarding: {error or 'missing codec/height/pixel format'}",
            file=sys.stderr,
        )
        temp_path.unlink(missing_ok=True)
        return

    if temp_size < int(original_size * MIN_OUTPUT_SIZE_RATIO):
        print(
            f"  Output suspiciously small ({format_file_size(temp_size)} vs "
            f"{format_file_size(original_size)}), discarding",
            file=sys.stderr,
        )
        temp_path.unlink(missing_ok=True)
        return

    print(f"  Original: {format_file_size(original_size)}  Output: {format_file_size(temp_size)}")

    if temp_size < original_size:
        print("  Output is smaller — replacing original")
        _critical_replace(temp_path, final_path)
        # For non-mp4 sources the original has a different path; remove it now that
        # the AV1 mp4 is in place. This deletion is not critical — if interrupted,
        # the next run will skip (final_path exists) and leave original cleanup to the user.
        if final_path != original_path:
            original_path.unlink(missing_ok=True)
    else:
        print("  Output is not smaller — discarding converted file")
        temp_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------

def convert_video(file_path: Path, temp_path: Path, ffmpeg_flags: List[str],
                  start_time: float, stats: Statistics) -> bool:
    """Transcode to temp_path, trying audio copy first then AAC fallback.

    Registers the subprocess for graceful shutdown. Cleans up temp on failure.
    """
    global _current_temp_path
    _current_temp_path = temp_path
    temp_path.parent.mkdir(parents=True, exist_ok=True)

    cmd_base = ["ffmpeg", "-vaapi_device", VAAPI_DEVICE, "-i", str(file_path)] + ffmpeg_flags

    print("  Attempting with audio copy...")
    success, err = _run_ffmpeg(cmd_base + ["-c:a", "copy", "-y", str(temp_path)])
    if success:
        duration = int(time() - start_time)
        print(f"✓ Converted: {file_path} (audio copy) in {duration}s")
        stats.processed += 1
        _current_temp_path = None
        return True

    if _shutdown_requested:
        temp_path.unlink(missing_ok=True)
        _current_temp_path = None
        return False

    print("  Audio copy failed, trying AAC re-encode...")
    success, err = _run_ffmpeg(cmd_base + ["-c:a", "aac", "-y", str(temp_path)])
    if success:
        duration = int(time() - start_time)
        print(f"✓ Converted: {file_path} (AAC re-encode) in {duration}s")
        stats.processed += 1
        _current_temp_path = None
        return True

    temp_path.unlink(missing_ok=True)
    if not _shutdown_requested:
        print(f"✗ Failed to convert: {file_path}", file=sys.stderr)
        if err:
            print(f"  Error: {err}", file=sys.stderr)
        stats.failed += 1
    _current_temp_path = None
    return False


# ---------------------------------------------------------------------------
# Per-file orchestration
# ---------------------------------------------------------------------------

def process_file(file_path: Path, workdir: Path, stats: Statistics, corrupted_report: Path) -> ProcessResult:
    """Process a single video file."""
    if _shutdown_requested:
        return ProcessResult.SKIPPED

    print("----------------------------------------")

    file_path, result = validate_file(file_path)
    if file_path is None:
        stats.failed += 1
        return result

    extension, result = validate_extension(file_path)
    if extension is None:
        stats.skipped += 1
        return result

    # Skip hidden temp files from our own previous runs
    if file_path.name.endswith(".transcode.tmp.mp4"):
        return ProcessResult.SKIPPED

    temp_path = get_temp_path(file_path)
    final_path = get_final_path(file_path, extension)

    if extension != "mp4" and len(final_path.name) > MAX_FILENAME_LEN:
        print(
            f"Output filename too long ({len(final_path.name)} > {MAX_FILENAME_LEN}), skipping",
            file=sys.stderr,
        )
        stats.skipped += 1
        return ProcessResult.SKIPPED

    # Remove any leftover temp file from a previously interrupted run
    if temp_path.exists():
        print(f"  Removing leftover temp file from previous run: {temp_path}")
        temp_path.unlink()

    # For non-mp4 sources, skip if the output mp4 already exists
    if extension != "mp4" and final_path.exists():
        print(f"  Output already exists, skipping: {final_path}")
        stats.skipped += 1
        return ProcessResult.SKIPPED

    if check_file_corruption(file_path, extension):
        print(f"  Skipping corrupted file: {file_path}", file=sys.stderr)
        try:
            with open(corrupted_report, "a") as f:
                f.write(str(file_path) + "\n")
            print(f"  Logged to: {corrupted_report}", file=sys.stderr)
        except OSError as e:
            print(f"  Failed to write to corrupted files report: {e}", file=sys.stderr)
        stats.failed += 1
        return ProcessResult.FAILED

    codec_name, height, pix_fmt, bitrate, fps, error = get_video_info(file_path)
    video_info, result = validate_video_info(file_path, codec_name, height, pix_fmt, bitrate, fps, error)
    if video_info is None:
        stats.failed += 1
        return result

    codec_name, height, pix_fmt, bitrate, fps = video_info

    if should_skip_mp4(extension, height, codec_name, pix_fmt, fps):
        print(f"  Already AV1 at target settings, skipping: {file_path}")
        stats.skipped += 1
        return ProcessResult.SKIPPED

    # FPS reduction always yields a smaller output, so skip the size estimate in that case.
    needs_fps_reduction = fps is not None and fps > MAX_FPS
    if not needs_fps_reduction:
        file_size = get_file_size(file_path)
        if file_size is not None:
            will_be_larger = estimate_output_size_increase(codec_name, height, bitrate, file_size)
            if will_be_larger:
                bitrate_str = f"{bitrate/1_000_000:.2f} Mbps" if bitrate else "unknown"
                print(
                    f"  Skipping: output estimated larger "
                    f"(codec: {codec_name}, bitrate: {bitrate_str})",
                    file=sys.stderr,
                )
                stats.skipped += 1
                return ProcessResult.SKIPPED

    print(f"Converting: {file_path} -> {final_path}")
    ffmpeg_flags = build_ffmpeg_flags(height, fps)
    start_time = time()

    success = convert_video(file_path, temp_path, ffmpeg_flags, start_time, stats)
    if not success:
        return ProcessResult.FAILED

    if check_file_corruption(temp_path, "mp4"):
        print(f"  Converted output failed corruption check, discarding", file=sys.stderr)
        temp_path.unlink(missing_ok=True)
        stats.processed -= 1
        stats.failed += 1
        return ProcessResult.FAILED

    finalize_output(file_path, temp_path, final_path)

    return ProcessResult.SUCCESS


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Main function to process all video files."""
    parser = argparse.ArgumentParser(
        description="Convert video files to HEVC MP4 format (hardware-accelerated via VA-API)",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--workdir",
        type=Path,
        default=DEFAULT_WORKDIR,
        help=f"Working directory to process (default: {DEFAULT_WORKDIR})"
    )
    args = parser.parse_args()

    workdir = args.workdir.resolve()

    if not workdir.exists():
        print(f"Error: Work directory does not exist: {workdir}", file=sys.stderr)
        sys.exit(1)

    if not workdir.is_dir():
        print(f"Error: Work directory is not a directory: {workdir}", file=sys.stderr)
        sys.exit(1)

    if not check_tools_available():
        sys.exit(1)

    print(f"Supported extensions: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
    print(f"Processing files in: {workdir}")

    stats = Statistics()
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    corrupted_report = workdir / f"corrupted-video-files-{timestamp}.txt"

    files = [f for f in workdir.rglob("*") if f.is_file()]

    for file_path in files:
        if _shutdown_requested:
            break
        process_file(file_path, workdir, stats, corrupted_report)

    print("----------------------------------------")
    print("Shutdown complete." if _shutdown_requested else "Conversion complete!")
    print(stats)
    if corrupted_report.exists():
        print(f"Corrupted files report: {corrupted_report}")

    if _shutdown_requested:
        sys.exit(130)


if __name__ == "__main__":
    main()
