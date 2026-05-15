# Duplicate Merger Plugin — Requirements

## Goal

Replace the built-in duplicate checker workflow with a faster, rule-based plugin UI
that merges scenes explicitly and predictably, leaving exactly one video file with
consolidated metadata from all duplicates.

## Core Semantics

- **Merge, never delete.** A "merge" means: consolidate all metadata into one scene,
  keep one video file, remove the rest. This is distinct from Stash's current
  "Merge Metadata" (keeps all files) and "Delete" (no metadata transfer).
- **Merge direction is explicit.** The UI says "Merge into [destination]", making
  clear which scene survives as the primary record.
- Multi-value fields (performers, tags, stash IDs): union of all sources.
- Single-value fields (studio, date, details): taken from the destination; sources
  fill in only if destination is empty.

## Quality Ranking (destination selection)

Rules evaluated in priority order; first rule that differentiates the group wins.

1. **Audio presence** — file with audio beats file without audio.

2. **Resolution** — files at ≥ 1080p are treated as equivalent (re-encoder downscales anyway).
   Among files below 1080p, higher resolution wins.

3. **Codec** — h264 or h265 beat any other codec. h264 vs h265 is a tie.

4. **Bitrate** — TBD. No clear threshold for "good" bitrate; needs further analysis.
   Same issue applies to the video-reencoder plugin.

5. **-converted suffix** — if a `-converted` file is *larger* than its counterpart,
   the non-converted file wins (the re-encoder already handles this on disk; the
   plugin aligns metadata accordingly).

Ties at every step: larger file size wins as a last resort.

### Audio edge case (Phase 2)

If the highest-quality video has no audio but a lower-quality duplicate does,
re-mux the audio track from the lower-quality file into the winner rather than
discarding it. This requires ffmpeg and is deferred to Phase 2.

## Metadata Extraction from Filenames

When the source scene (being merged away) has performer or studio names in its
filename that the destination scene lacks:

- Auto-extract candidate names by matching against existing performers/studios in
  the Stash library.
- Present matches to the user for confirmation before adding them to the destination.
- Unknown tokens (no library match) are flagged for manual review, not silently dropped.

## UI

Built as a Stash plugin UI page.

### Workflow

1. **Load** — fetch duplicate groups from Stash (pHash, configurable threshold).
2. **Rule preview** — for each group, show which scene becomes the destination and
   why (rule that matched), plus a diff of metadata changes.
3. **Review** — user can override the auto-selected destination per group, or
   exclude a group from the batch.
4. **Confirm & execute** — run all merges in sequence; update only the affected
   group row after each merge (no full-list reload).

### Labelling

- Use "Merge into →" with an arrow pointing at the destination scene.
- Destination scene is visually distinct from sources.

## Performance

Execute merges sequentially via `sceneMerge`. Update only the affected group row
after each merge (optimistic update), not the full list.

## GraphQL API surface

| Operation | Mutation/Query |
|---|---|
| Fetch duplicate groups | `findScenes` with pHash duplicate filter |
| Merge scenes | `sceneMerge(input: {source, destination, play_history, o_history})` |
| Read scene metadata | `findScene(id)` |
| Update scene metadata | `sceneUpdate` (for post-merge name extraction additions) |

## Out of scope

- Detecting duplicates beyond pHash (title/URL matching is left to built-in tools).
- Editing/scraping scene metadata unrelated to the merge operation.
- Bulk file operations (moving/renaming files on disk) — handled by the re-encoder plugin.

## Related plugins

- **no-audio-tagger** — flags scenes with no audio track; see `../no-audio-tagger/REQUIREMENTS.md`.
