#!/usr/bin/env python3

import argparse
import json
import os
import shutil
import subprocess
import sys
from enum import IntEnum
from pathlib import Path
from time import time
from typing import List, Optional, Tuple

# Constants
DEFAULT_WORKDIR = Path("/data")
MAX_HEIGHT = 1080
CRF_VALUE = 23
FFMPEG_PRESET = "slow"

# Supported file extensions
# mp4 is a special case, as it will only be downscaled to 1080p if necessary.
# Feel free to add more extensions, but verify whether they work first.
SUPPORTED_EXTENSIONS = {"mp4", "avi", "flv", "mkv", "mov", "mpg", "rmvb", "webm", "wmv"}


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


def check_tools_available() -> bool:
    """Check if ffmpeg and ffprobe are available."""
    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg not found in PATH", file=sys.stderr)
        return False
    if not shutil.which("ffprobe"):
        print("Error: ffprobe not found in PATH", file=sys.stderr)
        return False
    return True


def get_video_info(file_path: Path) -> Tuple[Optional[str], Optional[int], Optional[str], Optional[int], Optional[str]]:
    """Get video information using ffprobe.

    Returns:
        Tuple of (codec_name, height, pix_fmt, bitrate, error_message)
        If successful, error_message is None. Otherwise, other values are None.
        Bitrate is in bits per second, or None if not available.
    """
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,height,pix_fmt,bit_rate",
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
        duration = int(time() - start_time)
        if duration > 1:
            print(f"FFPROBE DURATION: {duration}s")

        data = json.loads(result.stdout)
        stream = data.get("streams", [{}])[0]

        codec_name = stream.get("codec_name", "")
        height = stream.get("height")
        pix_fmt = stream.get("pix_fmt", "")
        bitrate = stream.get("bit_rate")

        # Validate height is numeric
        if height is not None and not isinstance(height, int):
            try:
                height = int(height)
            except (ValueError, TypeError):
                return None, None, None, None, f"Invalid height value: {height}"

        # Validate bitrate is numeric
        if bitrate is not None:
            try:
                bitrate = int(bitrate)
            except (ValueError, TypeError):
                bitrate = None

        return codec_name, height, pix_fmt, bitrate, None
    except subprocess.CalledProcessError as e:
        return None, None, None, None, f"FFprobe failed to analyze file: {file_path} (exit code: {e.returncode})\nError: {e.stderr}"
    except json.JSONDecodeError as e:
        return None, None, None, None, f"Could not parse video information for: {file_path}"
    except Exception as e:
        return None, None, None, None, f"Unexpected error analyzing file: {file_path}\nError: {str(e)}"


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


def get_output_path(file_path: Path, extension: str, workdir: Path) -> Tuple[Optional[Path], ProcessResult]:
    """Generate output path based on input file and extension.

    Preserves directory structure relative to workdir.
    """
    # Get relative path from workdir to preserve directory structure
    try:
        relative_path = file_path.relative_to(workdir)
        parent_dir = relative_path.parent
    except ValueError:
        # File is not under workdir, use just the filename
        parent_dir = Path(".")

    if extension == "mp4":
        output_filename = file_path.stem + "-converted.mp4"
    else:
        output_filename = file_path.stem + ".mp4"

    output_path = workdir / parent_dir / output_filename

    if output_path.exists():
        print(f"Output file already exists, skipping: {output_path.relative_to(workdir)}")
        return None, ProcessResult.SKIPPED

    return output_path, ProcessResult.SUCCESS


def estimate_output_size_increase(codec_name: str, height: int, bitrate: Optional[int],
                                   file_size: int) -> Optional[bool]:
    """Estimate if output file will be larger than input.

    Returns:
        True if output is estimated to be larger, False if smaller, None if cannot estimate.
    """
    # If no bitrate info, use codec-based heuristics
    if bitrate is None:
        # H.265/HEVC is ~50% more efficient, so converting to H.264 will likely increase size
        if codec_name in ("hevc", "h265"):
            return True
        # Already H.264 with similar settings - likely similar or larger size
        if codec_name == "h264":
            # If no downscaling needed, likely to be similar or larger
            if height <= MAX_HEIGHT:
                return True
        # Older/less efficient codecs - likely to decrease size
        return False

    # Estimate target bitrate for H.264 at CRF 23
    # CRF 23 typically results in bitrates roughly:
    # - 1080p: ~3-5 Mbps
    # - 720p: ~2-3 Mbps
    # - 480p: ~1-2 Mbps
    # These are rough estimates and vary by content complexity

    if height > 1080:
        # Will be downscaled to 1080p
        estimated_target_bitrate = 4_000_000  # ~4 Mbps for 1080p at CRF 23
    elif height > 720:
        estimated_target_bitrate = 3_500_000  # ~3.5 Mbps for 720p-1080p
    elif height > 480:
        estimated_target_bitrate = 2_500_000  # ~2.5 Mbps for 480p-720p
    else:
        estimated_target_bitrate = 1_500_000  # ~1.5 Mbps for <480p

    # Adjust for codec efficiency differences
    # H.265 is ~50% more efficient, so same quality needs ~50% less bitrate
    if codec_name in ("hevc", "h265"):
        # If current bitrate is already efficient, H.264 will need more
        # Estimate: H.264 needs ~1.5-2x bitrate for same quality as H.265
        estimated_target_bitrate = int(estimated_target_bitrate * 1.5)
    elif codec_name == "h264":
        # Already H.264, target should be similar or slightly higher (re-encoding overhead)
        estimated_target_bitrate = int(bitrate * 1.1)

    # Compare: if current bitrate is lower than estimated target, output likely larger
    return bitrate < estimated_target_bitrate


def validate_video_info(file_path: Path, codec_name: Optional[str], height: Optional[int],
                        pix_fmt: Optional[str], bitrate: Optional[int], error: Optional[str]) -> Tuple[Optional[Tuple[str, int, str, Optional[int]]], ProcessResult]:
    """Validate video information from ffprobe."""
    if error:
        print(f"  {error}", file=sys.stderr)
        return None, ProcessResult.FAILED

    if not codec_name or height is None or not pix_fmt:
        print(f"  Could not parse video information for: {file_path}", file=sys.stderr)
        return None, ProcessResult.FAILED

    return (codec_name, height, pix_fmt, bitrate), ProcessResult.SUCCESS


def should_skip_mp4(extension: str, height: int, codec_name: str, pix_fmt: str) -> bool:
    """Check if MP4 file is already in desired format."""
    return (extension == "mp4" and
            height <= MAX_HEIGHT and
            codec_name == "h264")


def build_ffmpeg_flags(height: int) -> List[str]:
    """Build ffmpeg command flags based on video height."""
    ffmpeg_flags = [
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        "-crf", str(CRF_VALUE),
        "-hide_banner",
        "-loglevel", "error"
    ]

    if height > MAX_HEIGHT:
        ffmpeg_flags.extend(["-vf", f"scale=-2:{MAX_HEIGHT}"])

    return ffmpeg_flags


def compare_and_cleanup_files(original_path: Path, output_path: Path) -> None:
    """Compare file sizes and remove the larger file."""
    original_size = get_file_size(original_path)
    output_size = get_file_size(output_path)

    if original_size is None or output_size is None:
        return

    original_size_hr = format_file_size(original_size)
    output_size_hr = format_file_size(output_size)

    print(f"ORIGINAL SIZE: {original_size_hr}")
    print(f"OUTPUT SIZE: {output_size_hr}")

    if original_size < output_size:
        print(f"Output file is smaller than original file, removing original file: {original_path}")
        os.remove(original_path)
    else:
        print(f"Original file is smaller than output file, removing output file: {output_path}")
        os.remove(output_path)


def convert_video(file_path: Path, output_path: Path, ffmpeg_flags: List[str],
                  start_time: float, stats: Statistics) -> bool:
    """Convert video using ffmpeg, trying audio copy first, then AAC fallback."""
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Try audio copy first (faster, better quality)
    print("  Attempting with audio copy...")
    cmd_audio_copy = [
        "ffmpeg",
        "-i", str(file_path),
    ] + ffmpeg_flags + [
        "-c:a", "copy",
        "-y",
        str(output_path)
    ]

    try:
        subprocess.run(
            cmd_audio_copy,
            capture_output=True,
            check=True,
            stderr=subprocess.DEVNULL
        )
        duration = int(time() - start_time)
        print(f"✓ Successfully converted: {file_path} (with audio copy) in {duration}s")
        stats.processed += 1
        return True
    except subprocess.CalledProcessError:
        pass

    # Fallback to AAC re-encoding
    print("  Audio copy failed, trying with AAC re-encoding...")
    cmd_aac = [
        "ffmpeg",
        "-i", str(file_path),
    ] + ffmpeg_flags + [
        "-c:a", "aac",
        "-y",
        str(output_path)
    ]

    try:
        subprocess.run(
            cmd_aac,
            capture_output=True,
            check=True
        )
        duration = int(time() - start_time)
        print(f"✓ Successfully converted: {file_path} (with AAC re-encoding) in {duration}s")
        stats.processed += 1
        return True
    except subprocess.CalledProcessError:
        print(f"✗ Failed to convert: {file_path}", file=sys.stderr)
        stats.failed += 1
        return False


def process_file(file_path: Path, workdir: Path, stats: Statistics) -> ProcessResult:
    """Process individual video file."""
    print("----------------------------------------")

    # Validate file exists and is a regular file
    file_path, result = validate_file(file_path)
    if file_path is None:
        stats.failed += 1
        return result

    # Validate extension is supported
    extension, result = validate_extension(file_path)
    if extension is None:
        stats.skipped += 1
        return result

    # Generate output path
    output_path, result = get_output_path(file_path, extension, workdir)
    if output_path is None:
        stats.skipped += 1
        return result

    print(f"Converting: {file_path} -> {output_path}")

    # Get video properties using ffprobe
    codec_name, height, pix_fmt, bitrate, error = get_video_info(file_path)
    video_info, result = validate_video_info(file_path, codec_name, height, pix_fmt, bitrate, error)
    if video_info is None:
        stats.failed += 1
        return result

    codec_name, height, pix_fmt, bitrate = video_info

    # Check if already in desired format (for MP4 files)
    if should_skip_mp4(extension, height, codec_name, pix_fmt):
        print(f"  MP4 file already in desired format, skipping: {file_path}")
        stats.skipped += 1
        return ProcessResult.SKIPPED

    # Pre-check: estimate if output will be larger
    file_size = get_file_size(file_path)
    if file_size is not None:
        will_be_larger = estimate_output_size_increase(codec_name, height, bitrate, file_size)
        if will_be_larger:
            bitrate_str = f"{bitrate/1_000_000:.2f} Mbps" if bitrate else "unknown"
            print(f"  Warning: Estimated output file will be larger than input (codec: {codec_name}, bitrate: {bitrate_str})", file=sys.stderr)
            print(f"  Skipping to prevent infinite loop. File: {file_path}", file=sys.stderr)
            stats.skipped += 1
            return ProcessResult.SKIPPED

    # Build ffmpeg flags
    ffmpeg_flags = build_ffmpeg_flags(height)

    # Start timing
    start_time = time()

    # Convert video
    success = convert_video(file_path, output_path, ffmpeg_flags, start_time, stats)
    if not success:
        return ProcessResult.FAILED

    # Compare file sizes and cleanup
    compare_and_cleanup_files(file_path, output_path)

    return ProcessResult.SUCCESS


def main() -> None:
    """Main function to process all video files."""
    parser = argparse.ArgumentParser(
        description="Convert video files to H.264 MP4 format",
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

    # Find all files in the work directory (more efficient than rglob then filter)
    files = [f for f in workdir.rglob("*") if f.is_file()]

    try:
        for file_path in files:
            process_file(file_path, workdir, stats)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user", file=sys.stderr)
        print("\nStatistics so far:")
        print(stats)
        sys.exit(130)

    # Display final statistics
    print("----------------------------------------")
    print("Conversion complete!")
    print(stats)


if __name__ == "__main__":
    main()
