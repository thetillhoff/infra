(function () {
  'use strict';

  const React = window.PluginApi.React;
  const { useState, useCallback } = React;
  const e = React.createElement;

  // ---------------------------------------------------------------------------
  // GraphQL
  // ---------------------------------------------------------------------------

  async function gql(query, variables = {}) {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(err => err.message).join('; '));
    return json.data;
  }

  const QUERY_DUPLICATES = `
    query FindDuplicates($distance: Int!) {
      findDuplicateScenes(distance: $distance) {
        id title
        files { id path basename width height video_codec audio_codec bit_rate size duration frame_rate }
        performers { name }
        studio { name }
        tags { name }
      }
    }
  `;

  const MUTATION_MERGE = `
    mutation MergeScenes($source: [ID!]!, $destination: ID!) {
      sceneMerge(input: {
        source: $source
        destination: $destination
        play_history: true
        o_history: true
      }) { id }
    }
  `;

  const MUTATION_DESTROY_FILES = `
    mutation DestroyFiles($ids: [ID!]!) { destroyFiles(ids: $ids) }
  `;

  // ---------------------------------------------------------------------------
  // Quality ranking
  // ---------------------------------------------------------------------------

  const GOOD_CODECS = new Set(['h264', 'h265', 'hevc']);

  // Expected bitrate ranges (bps) per resolution tier
  const BITRATE_TIERS = [
    { maxHeight: 240,      min:   100_000, max:    700_000 },
    { maxHeight: 480,      min:   400_000, max:  2_500_000 },
    { maxHeight: 720,      min: 1_000_000, max:  6_000_000 },
    { maxHeight: 1080,     min: 2_500_000, max: 15_000_000 },
    { maxHeight: Infinity, min: 8_000_000, max: 60_000_000 },
  ];

  function scoreFile(file) {
    let score = 0;
    // Audio presence is the top criterion
    if (file.audio_codec) score += 100_000;
    // Resolution, capped at 1080p (re-encoder handles anything above)
    score += Math.min(file.height, 1080) * 100;
    // Preferred codecs
    if (GOOD_CODECS.has(file.video_codec)) score += 1_000;
    // Size as tiebreaker
    score += Math.round(file.size / 1_000_000);
    return score;
  }

  function pickDestination(scenes) {
    const nonConverted = scenes.filter(s => !s.files[0]?.basename.includes('-converted'));
    const maxNonConvertedSize = Math.max(0, ...nonConverted.map(s => s.files[0]?.size ?? 0));

    const ranked = scenes.map(scene => {
      const file = scene.files[0];
      if (!file) return { scene, score: -Infinity };
      let score = scoreFile(file);
      // Penalise -converted files that bloated compared to the original
      if (file.basename.includes('-converted') && file.size > maxNonConvertedSize) {
        score -= 500_000;
      }
      return { scene, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked[0].scene;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatSize(bytes) {
    if (bytes >= 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + ' GB';
    if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
    return Math.round(bytes / 1_000) + ' KB';
  }

  function formatBitrate(bps) {
    if (bps == null) return '—';
    if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(1) + ' Mbps';
    return Math.round(bps / 1_000) + ' kbps';
  }

  function bitrateColor(bps, height) {
    if (bps == null) return '#555';
    const tier = BITRATE_TIERS.find(t => height <= t.maxHeight) ?? BITRATE_TIERS[BITRATE_TIERS.length - 1];
    const { min, max } = tier;
    if (bps < min * 0.25 || bps > max * 5) return '#f66';
    if (bps < min * 0.6  || bps > max * 2) return '#fa6';
    if (bps < min        || bps > max)      return '#ec8';
    return '#7c7';
  }

  function formatFps(fps) {
    if (fps == null) return '—';
    const v = Math.round(fps * 100) / 100;
    return (v % 1 === 0 ? v.toString() : v.toFixed(2)) + ' fps';
  }

  function fpsColor(fps) {
    if (fps == null) return '#555';
    if (fps < 23.9) return '#fa6';        // below 24: bad
    if (fps <= 30.1) return '#7c7';       // 24–30: optimal
    if (fps <= 60.1) return '#ec8';       // 30–60: above target (reencoder will reduce)
    return '#fa6';                        // >60: suspicious
  }

  // Returns true if this file's fps is ~2× another file's fps in the group,
  // suggesting it was frame-interpolated from the lower-fps source.
  function isLikelyInterpolated(fps, group) {
    if (fps == null || fps <= 30) return false;
    return group.some(s => {
      const f = s.files[0]?.frame_rate;
      return f && Math.abs(f - fps) > 1 && Math.abs(fps / f - 2) < 0.15;
    });
  }

  function fileNotes(file, group) {
    const nonConverted = group.filter(s => !s.files[0]?.basename.includes('-converted'));
    const maxNonConvertedSize = Math.max(0, ...nonConverted.map(s => s.files[0]?.size ?? 0));

    // Oversized converted is the dominant reason — skip everything else
    if (file.basename.includes('-converted') && file.size > maxNonConvertedSize) {
      return [{ text: 'oversized -converted', ok: false }];
    }

    const winnerFile = pickDestination(group).files[0];
    const isWinner = !winnerFile || winnerFile.id === file.id;
    const notes = [];

    // Audio
    if (file.audio_codec) notes.push({ text: 'audio', ok: true });
    else notes.push({ text: 'no audio', ok: false });

    // Resolution — mark red if lower than winner's
    if (file.height >= 1080) {
      notes.push({ text: '≥1080p', ok: true });
    } else if (!isWinner && winnerFile && file.height < winnerFile.height) {
      notes.push({ text: `${file.height}p`, ok: false });
    } else {
      notes.push({ text: `${file.height}p`, ok: null });
    }

    // Codec — mark red if winner has a preferred codec and this one doesn't
    if (GOOD_CODECS.has(file.video_codec)) {
      notes.push({ text: file.video_codec, ok: true });
    } else if (!isWinner && winnerFile && GOOD_CODECS.has(winnerFile.video_codec)) {
      notes.push({ text: file.video_codec, ok: false });
    } else {
      notes.push({ text: file.video_codec, ok: null });
    }

    return notes;
  }

  // ---------------------------------------------------------------------------
  // Components
  // ---------------------------------------------------------------------------

  function SceneRow({ scene, group, isDestination, onSetDestination, disabled }) {
    const file = scene.files[0];
    if (!file) return null;

    const notes = fileNotes(file, group);

    return e('tr', {
      onClick: disabled ? undefined : onSetDestination,
      style: {
        cursor: disabled ? 'default' : 'pointer',
        background: isDestination ? 'rgba(70, 170, 255, 0.12)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
      },
    },
      e('td', { style: { padding: '8px 8px', width: '24px' } },
        isDestination
          ? e('span', { title: 'Merge destination', style: { color: '#4af', fontSize: '18px' } }, '★')
          : e('span', { style: { color: '#444', fontSize: '18px' } }, '○')
      ),
      e('td', { style: { padding: '8px 8px', maxWidth: '260px' } },
        e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          e('span', { style: { fontFamily: 'monospace', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.basename),
          isDestination && e('span', {
            style: { flexShrink: 0, fontSize: '12px', color: '#4af', background: 'rgba(70,170,255,0.15)', padding: '2px 8px', borderRadius: '10px' }
          }, 'merge into →')
        ),
        e('div', { style: { display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' } },
          ...notes.map(n => e('span', {
            key: n.text,
            style: {
              fontSize: '12px', padding: '1px 7px', borderRadius: '4px',
              color: n.ok === true ? '#7c7' : n.ok === false ? '#f88' : '#888',
              background: n.ok === true ? 'rgba(100,200,100,0.12)' : n.ok === false ? 'rgba(200,100,100,0.12)' : 'rgba(255,255,255,0.05)',
            }
          }, n.text))
        )
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', fontSize: '14px', color: '#aaa', whiteSpace: 'nowrap' } },
        `${file.width}×${file.height}`
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', fontSize: '14px', color: GOOD_CODECS.has(file.video_codec) ? '#aaa' : '#f88', whiteSpace: 'nowrap' } },
        file.video_codec
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap' } },
        e('span', { title: file.audio_codec || 'no audio', style: { color: file.audio_codec ? '#7c7' : '#f66', fontSize: '20px', lineHeight: 1 } },
          file.audio_codec ? '♪' : '✕'
        )
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', fontSize: '14px', color: bitrateColor(file.bit_rate, file.height), whiteSpace: 'nowrap' } },
        formatBitrate(file.bit_rate)
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', fontSize: '14px', whiteSpace: 'nowrap' } },
        e('span', {
          title: isLikelyInterpolated(file.frame_rate, group) ? 'fps is ~2× another file in this group — likely frame-interpolated' : undefined,
          style: { color: fpsColor(file.frame_rate) },
        },
          formatFps(file.frame_rate),
          isLikelyInterpolated(file.frame_rate, group) && e('span', { style: { marginLeft: '4px', fontSize: '12px' } }, '⚠')
        )
      ),
      e('td', { style: { padding: '8px 8px', textAlign: 'right', fontSize: '14px', color: '#aaa', whiteSpace: 'nowrap' } },
        formatSize(file.size)
      ),
    );
  }

  function GroupCard({ group, groupIndex, destination, onSetDestination, onMerge, isMerging, isMerged }) {
    const destScene = group.find(s => s.id === destination);

    return e('div', {
      style: {
        border: isMerged ? '1px solid rgba(100,200,100,0.3)' : '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        marginBottom: '12px',
        overflow: 'hidden',
      }
    },
      // Card header
      e('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          gap: '12px',
        }
      },
        e('span', { style: { fontSize: '13px', color: '#777' } },
          `Group ${groupIndex + 1} · ${group.length} files`
        ),
        isMerged
          ? e('span', { style: { color: '#7c7', fontSize: '13px' } }, '✓ Done')
          : e('button', {
              className: 'btn btn-sm btn-primary',
              onClick: onMerge,
              disabled: isMerging,
              style: { minWidth: '80px' },
            },
            isMerging ? 'Merging…' : 'Merge'
          )
      ),
      // Table
      e('table', { style: { width: '100%', borderCollapse: 'collapse' } },
        e('thead', null,
          e('tr', { style: { fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' } },
            e('th', { style: { padding: '4px 8px', width: '24px' } }),
            e('th', { style: { padding: '4px 8px', textAlign: 'left' } }, 'File'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'Resolution'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'Codec'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'Audio'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'Bitrate'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'FPS'),
            e('th', { style: { padding: '4px 8px', textAlign: 'right' } }, 'Size'),
          )
        ),
        e('tbody', null,
          ...group.map(scene =>
            e(SceneRow, {
              key: scene.id,
              scene,
              group,
              isDestination: scene.id === destination,
              onSetDestination: () => onSetDestination(scene.id),
              disabled: isMerged,
            })
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Main page
  // ---------------------------------------------------------------------------

  function DuplicateMergerPage() {
    const [groups, setGroups] = useState(null);
    const [destinations, setDestinations] = useState({});
    const [merging, setMerging] = useState({});
    const [merged, setMerged] = useState({});
    const [threshold, setThreshold] = useState(10);
    const [maxDurDiff, setMaxDurDiff] = useState(0); // null = any duration
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadGroups = useCallback(async () => {
      setLoading(true);
      setGroups(null);
      setMerged({});
      setError(null);
      try {
        const data = await gql(QUERY_DUPLICATES, { distance: threshold });
        const raw = data.findDuplicateScenes;
        const filtered = maxDurDiff === null ? raw : raw.filter(group => {
          const durations = group.map(s => s.files[0]?.duration ?? 0);
          return Math.max(...durations) - Math.min(...durations) <= maxDurDiff;
        });
        const dests = {};
        filtered.forEach((group, i) => { dests[i] = pickDestination(group).id; });
        setGroups(filtered);
        setDestinations(dests);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, [threshold, maxDurDiff]);

    const mergeGroup = useCallback(async (groupIndex) => {
      const group = groups[groupIndex];
      const destId = destinations[groupIndex];
      const sourceIds = group.filter(s => s.id !== destId).map(s => s.id);
      const fileIds = group.filter(s => s.id !== destId).flatMap(s => s.files.map(f => f.id));

      setMerging(prev => ({ ...prev, [groupIndex]: true }));
      try {
        await gql(MUTATION_MERGE, { source: sourceIds, destination: destId });
        await gql(MUTATION_DESTROY_FILES, { ids: fileIds });
        setMerged(prev => ({ ...prev, [groupIndex]: true }));
      } catch (err) {
        setError(`Group ${groupIndex + 1}: ${err.message}`);
      } finally {
        setMerging(prev => ({ ...prev, [groupIndex]: false }));
      }
    }, [groups, destinations]);

    const mergeAll = useCallback(async () => {
      for (let i = 0; i < groups.length; i++) {
        if (!merged[i]) await mergeGroup(i);
      }
    }, [groups, merged, mergeGroup]);

    const pendingCount = groups ? groups.filter((_, i) => !merged[i]).length : 0;
    const anyMerging = Object.values(merging).some(Boolean);

    return e('div', { style: { padding: '24px', maxWidth: '1200px' } },
      e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' } },
        e('h2', { style: { margin: 0 } }, 'Duplicate Merger'),
        groups !== null && e('span', { style: { color: '#666', fontSize: '14px' } },
          `${pendingCount} group${pendingCount !== 1 ? 's' : ''} pending`
        )
      ),

      // Controls bar
      e('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' } },
        e('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' } },
          e('label', { htmlFor: 'phash-distance' }, 'pHash distance:'),
          e('input', {
            id: 'phash-distance',
            type: 'number', min: 1, max: 30,
            value: threshold,
            onChange: ev => setThreshold(Math.max(1, Math.min(30, Number(ev.target.value)))),
            style: { width: '56px', padding: '4px 8px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: 'inherit', textAlign: 'center' }
          }),
          e('span', { style: { color: '#555', fontSize: '12px' } }, '(1 = identical, 10 = similar)')
        ),
        e('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' } },
          e('label', { htmlFor: 'dur-diff' }, 'Max duration diff:'),
          e('input', {
            id: 'dur-diff',
            type: 'number', min: 0, step: 1,
            value: maxDurDiff === null ? '' : maxDurDiff,
            placeholder: 'any',
            onChange: ev => {
              const v = ev.target.value;
              setMaxDurDiff(v === '' ? null : Math.max(0, Math.round(Number(v))));
            },
            style: { width: '64px', padding: '4px 8px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: 'inherit', textAlign: 'center' }
          }),
          e('span', { style: { color: '#555', fontSize: '12px' } }, 's (empty = any)')
        ),
        e('button', {
          className: 'btn btn-sm btn-secondary',
          onClick: loadGroups,
          disabled: loading,
        }, loading ? 'Loading…' : 'Load duplicates'),
        groups !== null && pendingCount > 0 && e('button', {
          className: 'btn btn-sm btn-success',
          onClick: mergeAll,
          disabled: anyMerging,
        }, anyMerging ? 'Merging…' : `Merge all ${pendingCount}`)
      ),

      // Error banner
      error && e('div', {
        style: {
          background: 'rgba(220,60,60,0.15)',
          border: '1px solid rgba(220,60,60,0.4)',
          borderRadius: '4px',
          padding: '10px 14px',
          marginBottom: '16px',
          color: '#f88',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }
      },
        e('span', null, error),
        e('button', {
          onClick: () => setError(null),
          style: { background: 'none', border: 'none', color: '#f88', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }
        }, '×')
      ),

      // Hint
      groups === null && !loading && e('p', { style: { color: '#666', fontSize: '14px' } },
        'Load duplicates to preview merge decisions. Click a row to change the destination. Click "Merge" to consolidate metadata and delete redundant files.'
      ),

      // Empty
      groups !== null && groups.length === 0 && e('p', { style: { color: '#777', fontStyle: 'italic' } },
        'No duplicates found at this threshold.'
      ),

      // Groups
      groups && groups.map((group, i) =>
        e(GroupCard, {
          key: i,
          group,
          groupIndex: i,
          destination: destinations[i],
          onSetDestination: id => setDestinations(prev => ({ ...prev, [i]: id })),
          onMerge: () => mergeGroup(i),
          isMerging: merging[i] || false,
          isMerged: merged[i] || false,
        })
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Register route and nav link
  // ---------------------------------------------------------------------------

  PluginApi.register.route('/plugin/duplicate-merger', DuplicateMergerPage);

  // Add an entry to Settings > Tools > Scene Tools section.
  // SettingsToolsSection is used twice on that page: once for General (1 child)
  // and once for Scene Tools (2+ children). Only add to the Scene Tools instance.
  // Note: result is {} in this Stash version — ignore it and rebuild from props.children.
  PluginApi.patch.after('SettingsToolsSection', function (props) {
    const children = React.Children.toArray(props.children);

    if (children.length < 2) return e(React.Fragment, null, ...children);

    const navigate = (ev) => {
      ev.preventDefault();
      window.history.pushState({}, '', '/plugin/duplicate-merger');
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    };

    const setting = e('div', { key: 'dup-merger', className: 'setting' },
      e('div', { className: 'setting-section' },
        e('h3', null,
          e('a', { href: '/plugin/duplicate-merger', onClick: navigate },
            e('button', { type: 'button', className: 'btn btn-secondary' }, 'Duplicate Merger')
          )
        )
      )
    );

    return e(React.Fragment, null, ...children, setting);
  });

})();
