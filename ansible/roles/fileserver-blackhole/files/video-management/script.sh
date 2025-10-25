#!/usr/bin/env bash

set -uo pipefail

# Set default directories if not provided
WORKDIR_DIR="/data"

# Supported file extensions
# mp4 is a special case, as it will only be downscaled to 1080p if necessary.
# Feel free to add more extensions, but verify whether they work first.
declare -a SUPPORTED_EXTENSIONS=("mp4" "avi" "flv" "mkv" "mov" "mpg" "rmvb" "webm" "wmv")

echo "Supported extensions: ${SUPPORTED_EXTENSIONS[*]}"

# Counter for processed files
declare -i processed=0
declare -i skipped=0
declare -i failed=0

# Global variable to store output filename
OUTPUT_FILENAME=""

# Associative array for file statistics (Ubuntu 24.04 compatible)
declare -A file_stats=()

# Function to process individual files
process_file() {
    local file="$1"
    
    # Reset global variable
    OUTPUT_FILENAME=""

    echo "----------------------------------------"

    # Check if it's a file (not a directory)
    if [[ -f "$file" ]]; then
        # Get filename without path
        input_filename=$(basename "$file")
        
        # Get file extension (lowercase) - bash parameter expansion
        extension="${input_filename##*.}"
        extension="${extension,,}"  # Convert to lowercase (Ubuntu 24.04 compatible)
        
        # Check if extension is in supported list (using bash array)
        is_supported=false
        for ext in "${SUPPORTED_EXTENSIONS[@]}"; do
            if [[ "$extension" == "$ext" ]]; then
                is_supported=true
                break
            fi
        done
        
        if [[ "$is_supported" == true ]]; then

            # Generate output filename (replace extension with mp4)
            output_filename="${input_filename%.*}.mp4"
            # Rename mp4 files to -converted.mp4
            if [[ "$extension" == "mp4" ]]; then
                output_filename="${input_filename%.*}-converted.mp4"
            fi

            if [[ -f "$WORKDIR_DIR/$output_filename" ]]; then
                echo "Output file already exists, skipping: $output_filename"
                return 1  # Return 1 for skipped
            fi
            
            echo "Converting: $file -> $WORKDIR_DIR/$output_filename"

            start_time=$SECONDS
            
            # Get video properties using ffprobe (with better error handling)
            if ! ffprobe_result=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name,height,pix_fmt -of csv=s=x:p=0 "$file" 2>&1); then
                ffprobe_exit_code=$?
                echo "  FFprobe failed to analyze file: $file (exit code: $ffprobe_exit_code)"
                echo "  Error: $ffprobe_result"
                return 2  # Return 2 for failed conversion
            else
                ffprobe_exit_code=0
            fi

            duration=$((SECONDS - start_time))
            if [[ "$duration" -gt 1 ]]; then
                echo "FFPROBE DURATION: ${duration}s"
            fi
            
            # Parse the video information
            if [[ -n "$ffprobe_result" ]]; then
                codec_name=$(echo "$ffprobe_result" | cut -d'x' -f1)
                height=$(echo "$ffprobe_result" | cut -d'x' -f2)
                pix_fmt=$(echo "$ffprobe_result" | cut -d'x' -f3)
                
                # Validate parsed values
                if [[ -n "$codec_name" && -n "$height" && -n "$pix_fmt" ]]; then
                    
                    # Check if already in desired format (for MP4 files)
                    if [[ "$extension" == "mp4" && "$height" -le 1080 && "$codec_name" == "h264" && "$pix_fmt" == "yuv420p" ]]; then
                        echo "  MP4 file already in desired format, skipping: $file"
                        return 1  # Return 1 for skipped
                    fi
                else
                    echo "  Could not parse video information for: $file"
                fi
            fi
            
            # Common ffmpeg flags
            FFMPEG_FLAGS="-c:v libx264 -pix_fmt yuv420p -preset slow -crf 23 -hide_banner -loglevel error"

            if [[ "$height" -gt 1080 ]]; then
                FFMPEG_FLAGS="$FFMPEG_FLAGS -vf scale=-2:1080"
            fi

            # Start timing using bash built-in
            start_time=$SECONDS
            
            # Set the output filename for successful processing
            OUTPUT_FILENAME="$WORKDIR_DIR/$output_filename"
            
            # Try ffmpeg conversion with audio copy first (faster, better quality)
            echo "  Attempting with audio copy..."
            if ffmpeg -i "$file" $FFMPEG_FLAGS -c:a copy "$WORKDIR_DIR/$output_filename" -y 2>/dev/null; then
                duration=$((SECONDS - start_time))
                echo "✓ Successfully converted: $file (with audio copy) in ${duration}s"
                return 0  # Return 0 for success
            else
                echo "  Audio copy failed, trying with AAC re-encoding..."
                # Fallback to AAC re-encoding
                if ffmpeg -i "$file" $FFMPEG_FLAGS -c:a aac "$WORKDIR_DIR/$output_filename" -y; then
                    duration=$((SECONDS - start_time))
                    echo "✓ Successfully converted: $file (with AAC re-encoding) in ${duration}s"
                    return 0  # Return 0 for success
                else
                    echo "✗ Failed to convert: $file"
                    return 2  # Return 2 for failed conversion
                fi
            fi
        else
            echo "Skipping unsupported file: $file (extension: $extension)"
            return 1  # Return 1 for skipped
        fi
    else
        echo "Not a file: $file"
        return 2  # Skipping non-file
    fi
}

# Store files in an array to avoid process substitution issues
mapfile -d '' files < <(find "$WORKDIR_DIR" -type f -print0)

for INPUT_FILENAME in "${files[@]}"; do
    # Process each file and capture the result
    process_file "$INPUT_FILENAME"
    result=$?
    
    # Handle statistics based on return code
    case $result in
        0)  # Success
            processed=$((processed + 1))

            if [[ -f "$OUTPUT_FILENAME" ]]; then

                start_time=$SECONDS

                # Get original file size BEFORE conversion
                original_size=$(stat -c %s "$INPUT_FILENAME")
                original_size_hr=$(ls -lh "$INPUT_FILENAME" | awk '{print $5}')
                
                # Get output file size AFTER conversion
                output_size=$(stat -c %s "$OUTPUT_FILENAME")
                output_size_hr=$(ls -lh "$OUTPUT_FILENAME" | awk '{print $5}')

                echo "ORIGINAL SIZE: $original_size_hr"
                echo "OUTPUT SIZE: $output_size_hr"

                duration=$((SECONDS - start_time))
                if [[ "$duration" -gt 1 ]]; then
                    echo "SIZE DETECTION DURATION: ${duration}s"
                fi

                if [[ "$original_size" -lt "$output_size" ]]; then
                    echo "Output file is smaller than original file, removing original file: $INPUT_FILENAME"
                    rm "$INPUT_FILENAME"
                else
                    echo "Original file is smaller than output file, removing output file: $OUTPUT_FILENAME"
                    rm "$OUTPUT_FILENAME"
                fi
            fi
            
            ;;
        1)  # Skipped
            skipped=$((skipped + 1))
            ;;
        2)  # Failed
            failed=$((failed + 1))
            ;;
    esac
done

# Display final statistics
echo "----------------------------------------"
echo "Conversion complete!"
echo "Files processed: $processed"
echo "Files skipped: $skipped"
echo "Files failed: $failed"
