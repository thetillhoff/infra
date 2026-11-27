# Duplicate Merger

Adds a "Keep this" button to each row of the native Scene Duplicate Checker (Settings, Tools).
The button merges the metadata of a duplicate group into the kept file and deletes the other files from disk.
The page does not reload: a resolved group is hidden.

## What a run does

For one group, in this order. A failed step stops the run before any delete.

1. `sceneUpdate` combines the metadata on the scene of the kept file.
2. The plugin reads the scene again. It stops when a tag or performer of any source is missing.
3. `sceneMerge` moves files, markers, and play and O history.
4. `sceneUpdate` makes the kept file the primary file.
5. `deleteFiles` deletes the other files from disk.

The "Dry run" box is on by default. It lists the calls and sends none.

## Scenes that already hold several files

The native Merge leaves one scene with several files. The bar above the table lists these scenes.
Each scene keeps its best file (same rules as below) and `deleteFiles` deletes the others. A scene with a 720p and a 1080p file is skipped: no file is deleted. Delete the extra file in Stash by hand. The dry run is on by default.

## Which file stays

Rules run in order. Each rule keeps the best files and the next rule decides between the rest.

1. The longer file (2 seconds tolerance, same as `video`).
2. A file with audio.
3. The higher short side. A group with both a 720p and a 1080p file needs a choice: no file is deleted until the user picks one. The suggested file is 1080p when a scene in the group has a rating of 5 stars, else 720p. A short side above 1080 also needs a choice.
4. The higher frame rate, counted up to 30 fps (same cap as `video shrink`).
5. The higher bitrate, counted up to the lean limit of `video` (350 kb/s at 720p, scaled by pixel count).
6. The smaller file.
7. The older file, then the lower file ID.

## Metadata

- Tags, URLs, galleries, stash IDs and groups of all scenes are combined.
- Performers are combined. The dialog shows when they differ.
- When two scenes have a different title, code, details, director, date, rating or studio, the dialog asks which value to keep. A value that only one scene has is copied.

## Files

- `rank.js`: the rules and the conflict check, no network.
- `plan.js`: the steps and the GraphQL queries.
- `duplicate-merger.js`: the page.
- `*.test.js`: run with `node --test`.

## Limits

- The native page is not patchable, so the plugin reads its table. A change of that table can break the buttons.
- The unit tests use a fake `gql`. The page and the mutations were checked once against Stash 0.32 with Playwright.
- Stash does not check files for corruption. The plugin cannot tell a damaged keeper from a good one.
