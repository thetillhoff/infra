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

# Constants
DEFAULT_WORKDIR = Path("/data")
MAX_HEIGHT = 1080
MAX_FPS = 30
QUALITY_VALUE = 28  # HEVC VA-API CQP quality; lower = better (roughly equivalent to H.265 CRF 28)
VAAPI_DEVICE = "/dev/dri/renderD128"
TARGET_CODEC = "hevc"
MAX_FILENAME_LEN = 255

# Supported file extensions
# mp4 is a special case: only converted if it needs downscaling, codec change, or fps reduction.
SUPPORTED_EXTENSIONS = {"mp4", "avi", "flv", "mkv", "mov", "mpg", "rmvb", "webm", "wmv"}

# ---------------------------------------------------------------------------
# Graceful shutdown state
# ---------------------------------------------------------------------------
_shutdown_requested = False
_current_process: subprocess.Popen | None = None
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


def parse_fps(fps_str: str | None) -> float | None:
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


def get_video_info(file_path: Path) -> tuple[str | None, int | None, str | None, int | None, float | None, float | None, str | None]:
    """Get video information using ffprobe.

    Returns:
        Tuple of (codec_name, height, pix_fmt, bitrate, fps, duration, error_message)
        If successful, error_message is None. Otherwise, other values are None.
        Bitrate is in bits per second. Derived from stream metadata when available,
        otherwise computed from file size / duration as a fallback.
        fps is frames per second, or None if not available.
        duration is in seconds, or None if not available.
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
                return None, None, None, None, None, None, f"Invalid height value: {height}"

        if bitrate is not None:
            try:
                bitrate = int(bitrate)
            except (ValueError, TypeError):
                bitrate = None

        duration: float | None = None
        try:
            raw_dur = fmt.get("duration")
            if raw_dur is not None:
                duration = float(raw_dur) or None
        except (ValueError, TypeError):
            pass

        # Fallback: derive bitrate from file size and duration (works for any container).
        # Some formats (MKV, WebM) don't embed per-stream bitrate in metadata.
        if bitrate is None:
            try:
                if duration and duration > 0:
                    bitrate = int(file_path.stat().st_size * 8 / duration)
            except (ValueError, TypeError, OSError) as e:
                return None, None, None, None, None, None, f"Could not compute fallback bitrate for: {file_path}\nError: {e}"

        if bitrate is None:
            return None, None, None, None, None, None, f"Could not determine bitrate for: {file_path}"

        return codec_name, height, pix_fmt, bitrate, fps, duration, None
    except subprocess.CalledProcessError as e:
        return None, None, None, None, None, None, f"FFprobe failed to analyze file: {file_path} (exit code: {e.returncode})\nError: {e.stderr}"
    except json.JSONDecodeError:
        return None, None, None, None, None, None, f"Could not parse video information for: {file_path}"
    except Exception as e:
        return None, None, None, None, None, None, f"Unexpected error analyzing file: {file_path}\nError: {str(e)}"


def get_file_size(file_path: Path) -> int | None:
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


def _log_corrupted(file_path: Path, report_path: Path) -> None:
    """Append file_path to the corrupted files report."""
    try:
        with open(report_path, "a") as f:
            f.write(str(file_path) + "\n")
        print(f"  Logged to: {report_path}", file=sys.stderr)
    except OSError as e:
        print(f"  Failed to write to corrupted files report: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_file(file_path: Path) -> tuple[Path | None, ProcessResult]:
    """Validate that file exists and is a regular file."""
    file_path = Path(file_path)
    if not file_path.is_file():
        print(f"Not a file: {file_path}", file=sys.stderr)
        return None, ProcessResult.FAILED
    return file_path, ProcessResult.SUCCESS


def validate_extension(file_path: Path) -> tuple[str | None, ProcessResult]:
    """Validate that file extension is supported."""
    extension = file_path.suffix.lstrip('.').lower()
    if extension not in SUPPORTED_EXTENSIONS:
        print(f"Skipping unsupported file: {file_path} (extension: {extension})")
        return None, ProcessResult.SKIPPED
    return extension, ProcessResult.SUCCESS


def validate_video_info(
    file_path: Path,
    codec_name: str | None,
    height: int | None,
    pix_fmt: str | None,
    bitrate: int | None,
    fps: float | None,
    error: str | None,
) -> tuple[tuple[str, int, str, int | None, float | None] | None, ProcessResult]:
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

def _strip_mp4_suffixes(stem: str) -> str:
    """Strip all trailing .mp4 suffixes from a filename stem (case-insensitive)."""
    while stem.lower().endswith(".mp4"):
        stem = stem[:-4]
    return stem


def get_temp_path(file_path: Path) -> Path:
    """Return the in-progress transcode path."""
    return file_path.parent / f"{file_path.stem}.tmp.mp4"


def get_final_path(file_path: Path, extension: str) -> Path:
    """Return the final output path.

    For mp4 sources with no double extension, returns file_path (in-place replacement).
    For all other cases (format change or double extension), returns the clean .mp4 path.
    """
    stem = _strip_mp4_suffixes(file_path.stem)
    if extension == "mp4" and stem == file_path.stem:
        return file_path  # no double extension: true in-place replacement
    return file_path.parent / f"{stem}.mp4"


def rename_if_double_mp4(file_path: Path) -> None:
    """Rename foo.mp4.mp4 -> foo.mp4 when the file is being skipped rather than transcoded."""
    stem = file_path.stem
    if not stem.lower().endswith(".mp4"):
        return
    new_path = file_path.parent / f"{_strip_mp4_suffixes(stem)}.mp4"
    try:
        file_path.rename(new_path)
        print(f"  Renamed: {file_path.name} -> {new_path.name}")
    except OSError as e:
        print(f"  Failed to rename {file_path.name}: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Encoding logic
# ---------------------------------------------------------------------------

def estimate_output_size_increase(codec_name: str, height: int, bitrate: int | None,
                                   file_size: int) -> tuple[bool, int | None]:
    """Estimate if output file will be larger than input.

    Returns (will_be_larger, estimated_target_bitrate).
    estimated_target_bitrate is None when the decision is not bitrate-based.
    """
    if bitrate is None:
        if codec_name in ("hevc", "h265", "av1"):
            return True, None
        return False, None

    # Output height is capped at MAX_HEIGHT because we scale down before encoding.
    output_height = min(height, MAX_HEIGHT)

    if codec_name in ("hevc", "h265"):
        # Re-encoding HEVC at the same CQP adds ~10% generation loss with no efficiency gain.
        estimated_target_bitrate = int(bitrate * 1.1)
    else:
        # Power-law model for HEVC CQP 28 typical content, calibrated at two points:
        #   480p → ~600 kbps, 1080p → ~2.0 Mbps (exponent 1.5 sits between linear-height
        #   and pixel-area scaling, reflecting HEVC's improved efficiency at higher resolutions).
        # Continuous examples: 240p→212kbps, 360p→390kbps, 720p→1.1Mbps, 1080p→2.0Mbps
        estimated_target_bitrate = int(600_000 * (output_height / 480) ** 1.5)
        if codec_name == "av1":
            # AV1 is ~15% more efficient than HEVC; the HEVC output needs proportionally more bits.
            estimated_target_bitrate = int(estimated_target_bitrate * 1.15)

    return bitrate < estimated_target_bitrate, estimated_target_bitrate


def should_skip_mp4(extension: str, height: int, codec_name: str, fps: float | None) -> bool:
    """Check if MP4 file is already in desired format."""
    if not (extension == "mp4" and height <= MAX_HEIGHT and codec_name == TARGET_CODEC):
        return False
    if fps is not None and fps > MAX_FPS:
        return False
    return True


def build_ffmpeg_flags(height: int, fps: float | None, hwdec: bool = False) -> list[str]:
    """Build ffmpeg output flags for HEVC VA-API hardware encoding.

    hwdec=True: frames arrive as vaapi surfaces; format=nv12+hwupload are omitted and
    any software filter (fps) is sandwiched between hwdownload/hwupload.
    hwdec=False: software decode path; format=nv12+hwupload always present.
    The -vaapi_device global option is added in convert_video before -i.
    """
    vf_filters = []
    needs_fps = fps is not None and fps > MAX_FPS

    if hwdec:
        if needs_fps:
            vf_filters.extend(["hwdownload", "format=nv12", f"fps={MAX_FPS}", "format=nv12", "hwupload"])
        if height > MAX_HEIGHT:
            vf_filters.append(f"scale_vaapi=-2:{MAX_HEIGHT}")
        else:
            # Explicitly align dimensions to even numbers so ffmpeg doesn't auto-insert
            # a software scale filter that can't handle vaapi surfaces.
            vf_filters.append("scale_vaapi=trunc(iw/2)*2:trunc(ih/2)*2")
    else:
        if needs_fps:
            vf_filters.append(f"fps={MAX_FPS}")
        vf_filters.extend(["format=nv12", "hwupload"])
        if height > MAX_HEIGHT:
            vf_filters.append(f"scale_vaapi=-2:{MAX_HEIGHT}")
        else:
            vf_filters.append("scale_vaapi=trunc(iw/2)*2:trunc(ih/2)*2")

    flags = [
        "-c:v", "hevc_vaapi",
        "-rc_mode", "CQP",
        "-global_quality", str(QUALITY_VALUE),
        "-hide_banner",
        "-loglevel", "error",
    ]
    if vf_filters:
        flags += ["-vf", ",".join(vf_filters)]
    return flags


# ---------------------------------------------------------------------------
# Corruption checking
# ---------------------------------------------------------------------------

def check_file_corruption(file_path: Path, extension: str) -> bool:
    """Check if a video file appears corrupted via header inspection.

    For MP4/MOV files, verifies the presence of the 'ftyp' ISO base-media atom in
    the first 64 bytes.

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

    return False


# ---------------------------------------------------------------------------
# Graceful-shutdown-aware ffmpeg execution and file replacement
# ---------------------------------------------------------------------------

def _run_ffmpeg(cmd: list[str]) -> tuple[bool, str]:
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


def _min_expected_output_bytes(height: int, duration: float) -> int:
    """Minimum plausible output size for HEVC at a given resolution and duration.

    Uses very conservative bitrate floors — only meant to catch broken (near-empty)
    encodes, not to enforce quality. The ffprobe validation in finalize_output already
    catches structurally invalid files.
    """
    output_height = min(height, MAX_HEIGHT)
    if output_height >= 1080:
        min_kbps = 200
    elif output_height >= 720:
        min_kbps = 100
    elif output_height >= 480:
        min_kbps = 50
    else:
        min_kbps = 25
    return int(min_kbps * 1000 / 8 * duration)


def finalize_output(original_path: Path, temp_path: Path, final_path: Path,
                    source_height: int, source_duration: float | None) -> None:
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

    codec_name, height, pix_fmt, _, _fps, _dur, error = get_video_info(temp_path)
    if error or not codec_name or height is None or not pix_fmt:
        print(
            f"  Converted file invalid, discarding: {error or 'missing codec/height/pixel format'}",
            file=sys.stderr,
        )
        temp_path.unlink(missing_ok=True)
        return

    if source_duration:
        min_size = _min_expected_output_bytes(source_height, source_duration)
        if temp_size < min_size:
            print(
                f"  Output suspiciously small ({format_file_size(temp_size)}, "
                f"expected at least {format_file_size(min_size)} for "
                f"{source_duration:.0f}s at {min(source_height, MAX_HEIGHT)}p), discarding",
                file=sys.stderr,
            )
            temp_path.unlink(missing_ok=True)
            return

    print(f"  Original: {format_file_size(original_size)}  Output: {format_file_size(temp_size)}")

    if temp_size < original_size:
        saved = format_file_size(original_size - temp_size)
        if final_path == original_path:
            print(f"  Replacing original with converted output (saved {saved})")
        else:
            print(f"  Saving as {final_path} (saved {saved})")
        _critical_replace(temp_path, final_path)
        # For non-mp4 sources the original has a different path; remove it now that
        # the HEVC mp4 is in place. This deletion is not critical — if interrupted,
        # the next run will skip (final_path exists) and leave original cleanup to the user.
        if final_path != original_path:
            print(f"  Removing original {original_path}")
            original_path.unlink(missing_ok=True)
    else:
        if source_duration:
            src_mbps = original_size * 8 / source_duration / 1_000_000
            out_mbps = temp_size * 8 / source_duration / 1_000_000
            print(
                f"  Output is not smaller — discarding "
                f"(source: {source_height}p, {src_mbps:.2f} Mbps → output: {out_mbps:.2f} Mbps)"
            )
        else:
            print(f"  Output is not smaller — discarding (source: {source_height}p, duration unknown)")
        temp_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------

def convert_video(file_path: Path, temp_path: Path,
                  hwdec_flags: list[str], swdec_flags: list[str],
                  stats: Statistics) -> bool:
    """Transcode to temp_path, trying hwdec then swdec, audio copy then AAC each time.

    Registers the subprocess for graceful shutdown. Cleans up temp on failure.
    """
    temp_path.parent.mkdir(parents=True, exist_ok=True)

    decode_attempts = [
        (["ffmpeg", "-vaapi_device", VAAPI_DEVICE,
           "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi",
           "-i", str(file_path)], hwdec_flags, "hwdec"),
        (["ffmpeg", "-vaapi_device", VAAPI_DEVICE,
           "-i", str(file_path)], swdec_flags, "swdec"),
    ]
    start_time = time()
    err = ""

    for cmd_base, enc_flags, decode_label in decode_attempts:
        for audio_opt, audio_label in [(["-c:a", "copy"], "audio copy"), (["-c:a", "aac"], "AAC re-encode")]:
            label = f"{decode_label}, {audio_label}"
            print(f"  Attempting with {label}...")
            success, err = _run_ffmpeg(cmd_base + enc_flags + audio_opt + ["-y", str(temp_path)])
            if success:
                duration = int(time() - start_time)
                print(f"✓ Converted in {duration}s ({label})")
                stats.processed += 1
                return True
            if _shutdown_requested:
                temp_path.unlink(missing_ok=True)
                return False

    temp_path.unlink(missing_ok=True)
    if not _shutdown_requested:
        print(f"✗ Failed to convert: {file_path}", file=sys.stderr)
        if err:
            print(f"  Error: {err}", file=sys.stderr)
        stats.failed += 1
    return False


# ---------------------------------------------------------------------------
# Per-file orchestration
# ---------------------------------------------------------------------------

def process_file(file_path: Path, stats: Statistics, corrupted_report: Path,
                 index: int, total: int) -> ProcessResult:
    """Process a single video file."""
    if _shutdown_requested:
        return ProcessResult.SKIPPED

    # Skip hidden temp files silently before printing a separator
    if file_path.name.endswith(".tmp.mp4"):
        return ProcessResult.SKIPPED

    print(f"--- ({index}/{total}) ---")

    file_path, result = validate_file(file_path)
    if file_path is None:
        stats.failed += 1
        return result

    extension, result = validate_extension(file_path)
    if extension is None:
        stats.skipped += 1
        return result

    temp_path = get_temp_path(file_path)
    final_path = get_final_path(file_path, extension)

    if len(temp_path.name) > MAX_FILENAME_LEN:
        print(
            f"Filename too long to transcode ({len(temp_path.name)} > {MAX_FILENAME_LEN}), skipping: {file_path.name}",
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
        _log_corrupted(file_path, corrupted_report)
        stats.failed += 1
        return ProcessResult.FAILED

    codec_name, height, pix_fmt, bitrate, fps, source_duration, error = get_video_info(file_path)
    video_info, result = validate_video_info(file_path, codec_name, height, pix_fmt, bitrate, fps, error)
    if video_info is None:
        print(f"  Skipping unreadable file: {file_path}", file=sys.stderr)
        _log_corrupted(file_path, corrupted_report)
        stats.failed += 1
        return result

    codec_name, height, pix_fmt, bitrate, fps = video_info

    if should_skip_mp4(extension, height, codec_name, fps):
        print(f"  Already HEVC at target settings, skipping: {file_path}")
        rename_if_double_mp4(file_path)
        stats.skipped += 1
        return ProcessResult.SKIPPED

    # FPS reduction always yields a smaller output, so skip the size estimate in that case.
    needs_fps_reduction = fps is not None and fps > MAX_FPS
    if not needs_fps_reduction:
        file_size = get_file_size(file_path)
        if file_size is not None:
            will_be_larger, est_target = estimate_output_size_increase(codec_name, height, bitrate, file_size)
            if will_be_larger:
                bitrate_str = f"{bitrate/1_000_000:.2f} Mbps" if bitrate else "unknown"
                est_str = f", est. output: {est_target/1_000_000:.2f} Mbps" if est_target else ""
                print(
                    f"  Skipping: output estimated larger "
                    f"(codec: {codec_name}, {height}p, source: {bitrate_str}{est_str})",
                )
                rename_if_double_mp4(file_path)
                stats.skipped += 1
                return ProcessResult.SKIPPED

    reasons = []
    if extension != "mp4":
        reasons.append(f"format ({extension}→mp4)")
    if codec_name != TARGET_CODEC:
        reasons.append(f"codec ({codec_name}→{TARGET_CODEC})")
    if height > MAX_HEIGHT:
        reasons.append(f"resolution ({height}p→{MAX_HEIGHT}p)")
    if needs_fps_reduction and fps is not None:
        reasons.append(f"fps ({fps:.2f}→{MAX_FPS})")
    print(f"Converting {file_path}")
    print(f"  to:     {temp_path}")
    print(f"  reason: {', '.join(reasons) or 'unknown'}")
    hwdec_flags = build_ffmpeg_flags(height, fps, hwdec=True)
    swdec_flags = build_ffmpeg_flags(height, fps, hwdec=False)

    success = convert_video(file_path, temp_path, hwdec_flags, swdec_flags, stats)
    if not success:
        return ProcessResult.FAILED

    if check_file_corruption(temp_path, "mp4"):
        print(f"  Converted output failed corruption check, discarding", file=sys.stderr)
        temp_path.unlink(missing_ok=True)
        stats.processed -= 1
        stats.failed += 1
        return ProcessResult.FAILED

    finalize_output(file_path, temp_path, final_path, height, source_duration)

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

    files = [
        f for f in workdir.rglob("*")
        if f.is_file()
        and f.suffix.lstrip(".").lower() in SUPPORTED_EXTENSIONS
        and not f.name.endswith(".tmp.mp4")
    ]
    total = len(files)
    print(f"Found {total} video files")

    for index, file_path in enumerate(files, 1):
        if _shutdown_requested:
            break
        process_file(file_path, stats, corrupted_report, index, total)

    print("----------------------------------------")
    print("Shutdown complete." if _shutdown_requested else "Conversion complete!")
    print(stats)
    if corrupted_report.exists():
        print(f"Corrupted files report: {corrupted_report}")

    if _shutdown_requested:
        sys.exit(130)


if __name__ == "__main__":
    main()
