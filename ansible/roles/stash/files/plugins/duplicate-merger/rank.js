// Pure decision logic of the duplicate plugin. No DOM, no network: loaded by the page and by the tests.
// A candidate is one file of one scene. Rules run in order; each keeps only the best survivors.
(function (root) {
  'use strict';

  const MAX_FPS = 30; // same cap as `video shrink`
  const DUR_TOLERANCE = 2; // seconds, same as `video`
  const LEAN_KBPS_720 = 350; // same as `video`: at 720p a bitrate above this is "enough"
  const HD = 1080;
  const SD = 720;

  const shortSide = (f) => Math.min(f.width || 0, f.height || 0);
  const fpsOf = (f) => Math.min(f.frame_rate || 0, MAX_FPS);
  const leanBps = (f) => (LEAN_KBPS_720 * 1000 * shortSide(f) ** 2) / (SD * SD);
  const bitrateOf = (f) => Math.min(f.bit_rate || 0, leanBps(f));
  const resClass = (s) => (s >= 1000 ? HD : s >= 600 ? SD : 0);

  function candidates(scenes) {
    return scenes.flatMap((scene) => (scene.files || []).map((file) => ({ scene, file })));
  }

  // Keep the survivors whose key is within `tol` of the best key (higher is better).
  function best(list, key, tol = 0) {
    const top = Math.max(...list.map(key));
    return list.filter((c) => key(c) >= top - tol);
  }

  // Target short side of a group: HD when any scene is rated high enough, else SD.
  function targetSide(scenes, ratingForHd) {
    return scenes.some((s) => (s.rating100 || 0) >= ratingForHd) ? HD : SD;
  }

  const RULES = [
    ['longer duration', (l) => best(l, (c) => c.file.duration || 0, DUR_TOLERANCE)],
    ['has audio', (l) => best(l, (c) => (c.file.audio_codec ? 1 : 0))],
    ['higher frame rate (up to 30)', (l) => best(l, (c) => fpsOf(c.file), 0.5)],
    ['higher bitrate (up to the lean limit)', (l) => best(l, (c) => bitrateOf(c.file), 0)],
    ['smaller file', (l) => best(l, (c) => -(c.file.size || 0))],
    ['older file', (l) => best(l, (c) => -new Date(c.file.mod_time || 0).getTime())],
    ['lower file id', (l) => best(l, (c) => -Number(c.file.id))],
  ];

  // Resolution rule: bigger wins, except a group that holds both an HD and an SD file
  // needs a human. `target` only picks which of the two is suggested.
  function byResolution(list, target) {
    const top = Math.max(...list.map((c) => shortSide(c.file)));
    if (top > HD + 15) return { survivors: list.filter((c) => shortSide(c.file) === top), manual: 'short side above 1080 - run video shrink first' };
    const classes = new Set(list.map((c) => resClass(shortSide(c.file))).filter(Boolean));
    if (classes.size > 1) {
      const want = list.filter((c) => resClass(shortSide(c.file)) === target);
      return { survivors: want.length ? want : list, manual: 'both 720p and 1080p present' };
    }
    if (classes.size === 1) return { survivors: list.filter((c) => resClass(shortSide(c.file))), manual: null };
    return { survivors: best(list, (c) => shortSide(c.file), 8), manual: null };
  }

  // -> {keeper, losers, manual, trail}. `manual` is a reason string when a human must confirm.
  function pickKeeper(scenes, opts = {}) {
    const target = targetSide(scenes, opts.ratingForHd ?? 100);
    let list = candidates(scenes);
    const trail = [];
    let manual = null;
    const step = (name, fn) => {
      if (list.length < 2) return;
      const next = fn(list);
      if (next.length < list.length) trail.push(name);
      list = next;
    };
    for (const [name, fn] of RULES.slice(0, 2)) step(name, fn);
    if (list.length > 1) {
      const r = byResolution(list, target);
      if (r.survivors.length < list.length) trail.push('higher resolution');
      list = r.survivors;
      manual = r.manual;
    }
    for (const [name, fn] of RULES.slice(2)) step(name, fn);
    const keeper = list[0];
    const losers = candidates(scenes).filter((c) => c.file.id !== keeper.file.id);
    return { keeper, losers, manual, trail, target };
  }

  const SINGLE = ['title', 'code', 'details', 'director', 'date', 'rating100'];
  const idsOf = (xs) => (xs || []).map((x) => String(x.id)).sort();

  // Fields where two scenes both have a value and the values differ.
  // Tags, URLs, galleries and stash IDs are unioned without asking; performers and
  // single-value fields are flagged. `proposal` is what a plain confirm would write.
  function findConflicts(keeperScene, otherScenes) {
    const out = [];
    const all = [keeperScene, ...otherScenes];
    for (const f of SINGLE) {
      const vals = all.filter((s) => s[f] != null && s[f] !== '' && s[f] !== 0);
      if (new Set(vals.map((s) => String(s[f]))).size > 1)
        out.push({ field: f, values: vals.map((s) => ({ scene: s.id, value: s[f] })), proposal: keeperScene[f] ?? vals[0][f] });
    }
    const studios = all.filter((s) => s.studio);
    if (new Set(studios.map((s) => s.studio.id)).size > 1)
      out.push({ field: 'studio', values: studios.map((s) => ({ scene: s.id, value: s.studio.name })), proposal: (keeperScene.studio || studios[0].studio).id });
    const withPerf = all.filter((s) => (s.performers || []).length);
    if (new Set(withPerf.map((s) => idsOf(s.performers).join(','))).size > 1) {
      const union = [...new Set(withPerf.flatMap((s) => idsOf(s.performers)))];
      out.push({ field: 'performers', values: withPerf.map((s) => ({ scene: s.id, value: (s.performers || []).map((p) => p.name).join(', ') })), proposal: union });
    }
    return out;
  }

  // Ids that sceneUpdate must put on the keeper scene so nothing is lost.
  function unionIds(scenes, field) {
    return [...new Set(scenes.flatMap((s) => idsOf(s[field])))];
  }

  const api = { pickKeeper, findConflicts, unionIds, targetSide, shortSide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DupRank = api;
})(typeof window !== 'undefined' ? window : globalThis);
