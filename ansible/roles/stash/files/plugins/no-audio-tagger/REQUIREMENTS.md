# No-Audio Tagger Plugin — Requirements

## Goal

Scan all scenes in the Stash library, check whether each video file has an audio
track, and apply a `no-audio` tag to any scene that lacks one.

## Use cases

- Pre-processing step before the duplicate-merger plugin: surface files that would
  lose audio if chosen as the merge destination.
- General library health check.

## Behaviour

- Creates the `no-audio` tag if it doesn't already exist.
- Removes the `no-audio` tag from scenes where audio is subsequently found (idempotent).
- Uses ffprobe to inspect audio streams (already available in the Stash container).

## Out of scope

- Adding or re-muxing audio tracks (handled by duplicate-merger Phase 2).
