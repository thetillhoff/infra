# Video Management Software

<!-- This README was AI generated -->

A Python-based video conversion tool that automatically converts video files to H.264 MP4 format for improved compatibility and storage efficiency.

## Overview

This software processes video files in a directory tree, converting them to a standardized H.264 MP4 format. It intelligently handles various video formats, downscales high-resolution videos, and optimizes file sizes while preserving directory structure.

## Features

- **Multi-format Support**: Converts videos from various formats (AVI, FLV, MKV, MOV, MPG, RMVB, WebM, WMV) to MP4
- **Automatic Downscaling**: Reduces videos taller than 1080p to 1080p resolution
- **Smart Processing**:
  - Skips MP4 files that are already in the desired format (H.264, ≤1080p)
  - Estimates output size to prevent unnecessary conversions
  - Validates converted files to ensure quality
- **Size Optimization**: Automatically keeps the smaller file (original or converted) after processing
- **Directory Preservation**: Maintains the original directory structure in the output
- **Safety Checks**:
  - Validates converted files are valid videos
  - Prevents suspiciously small outputs (likely corruption)
  - Skips files if output would be larger than input

## Technical Details

### Video Encoding Settings

- **Codec**: H.264 (libx264)
- **Pixel Format**: yuv420p (for maximum compatibility)
- **Quality**: CRF 23 (constant rate factor)
- **Preset**: slow (better compression efficiency)
- **Max Resolution**: 1080p (videos taller than 1080p are downscaled)
- **Audio**: Attempts audio copy first, falls back to AAC re-encoding if needed

### Supported Formats

Input formats: `mp4`, `avi`, `flv`, `mkv`, `mov`, `mpg`, `rmvb`, `webm`, `wmv`

Note: MP4 files are only processed if they need downscaling or codec conversion. Files already in H.264 format at ≤1080p are skipped.

## Usage

### Command Line

```bash
python3 script.py [--workdir /path/to/videos]
```

**Arguments:**

- `--workdir`: Working directory containing video files to process (default: `/data`)

### Docker Compose

The software is designed to run in a Docker container:

```bash
docker compose up -d
```

This will:

1. Build the Docker image (based on `jrottenberg/ffmpeg:8.0-ubuntu-edge`)
2. Mount the video directory at `/data`
3. Process all video files recursively in the directory tree

### Configuration

The docker-compose.yml file mounts:

- `./script.py` → `/script.py` (read-only)
- `/mnt/cold/public/videos` → `/data` (read-write)

Adjust the volume mounts in `docker-compose.yml` to point to your video directory.

## Processing Logic

1. **File Discovery**: Recursively finds all files in the work directory
2. **Validation**: Checks if file exists, has a supported extension, and output doesn't already exist
3. **Video Analysis**: Uses `ffprobe` to extract video properties (codec, resolution, bitrate)
4. **Skip Check**: Skips MP4 files already in desired format
5. **Size Estimation**: Estimates if output would be larger than input (skips if so)
6. **Conversion**: Converts video using ffmpeg with optimized settings
7. **Validation**: Verifies converted file is a valid video
8. **Cleanup**: Compares file sizes and removes the larger file

## Output

The script provides:

- Progress information for each file processed
- File size comparisons (original vs. converted)
- Final statistics:
  - Files processed
  - Files skipped
  - Files failed

### Output File Naming

- **MP4 input files**: `filename-converted.mp4`
- **Other formats**: `filename.mp4`

Output files are placed in the same directory as the input file, preserving the directory structure.

## Requirements

- Python 3
- ffmpeg (with libx264 support)
- ffprobe

These are included in the Docker image.

## Safety Features

1. **File Validation**: Validates converted files are valid videos before cleanup
2. **Size Ratio Check**: Rejects outputs smaller than 20% of original (likely corruption)
3. **Size Estimation**: Prevents converting files that would result in larger output
4. **No Overwrite**: Skips files if output already exists
5. **Error Handling**: Gracefully handles conversion failures and continues processing

## Limitations

- Only processes video files with supported extensions
- Maximum filename length: 255 characters
- Assumes videos are in a standard format (may fail on corrupted or unusual files)
- Processing time depends on video length and resolution (uses "slow" preset for quality)

## Example Output

```text
Supported extensions: avi, flv, mkv, mov, mp4, mpg, rmvb, webm, wmv
Processing files in: /data
----------------------------------------
Converting: /data/movie.avi -> /data/movie.mp4
  Attempting with audio copy...
✓ Successfully converted: /data/movie.avi (with audio copy) in 45s
ORIGINAL SIZE: 2.5GB
OUTPUT SIZE: 1.8GB
Original file is smaller than output file, removing output file: /data/movie.mp4
----------------------------------------
Conversion complete!
Files processed: 1
Files skipped: 0
Files failed: 0
```
