// Builds and runs the steps that resolve one duplicate group. `gql` is injected, so the tests use a fake.
(function (root) {
  'use strict';

  const SCENE_FIELDS = `
    id title code details director date rating100 urls
    studio { id name }
    performers { id name }
    tags { id }
    galleries { id }
    groups { group { id } scene_index }
    stash_ids { endpoint stash_id }
    files { id path basename width height duration frame_rate bit_rate size audio_codec video_codec mod_time missing_since }`;

  const Q = {
    scenes: `query ($ids: [ID!]) { findScenes(ids: $ids, filter: { per_page: -1 }) { scenes { ${SCENE_FIELDS} } } }`,
    update: `mutation ($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
    merge: `mutation ($input: SceneMergeInput!) { sceneMerge(input: $input) { id } }`,
    deleteFiles: `mutation ($ids: [ID!]!) { deleteFiles(ids: $ids) }`,
    destroyFiles: `mutation ($ids: [ID!]!) { destroyFiles(ids: $ids) }`,
  };

  const uniq = (xs) => [...new Set(xs)];
  const ids = (xs) => (xs || []).map((x) => String(x.id));

  // keeper: {scene, file}; losers: [{scene, file}]; choices: {field: sceneId} for flagged single-value fields.
  function buildPlan(scenes, keeper, losers, conflicts, choices = {}) {
    const dest = keeper.scene;
    const others = scenes.filter((s) => s.id !== dest.id);
    const input = { id: dest.id };
    const fromScene = (field) => {
      const c = conflicts.find((x) => x.field === field);
      if (c && choices[field] != null) return scenes.find((s) => s.id === choices[field]);
      return null;
    };
    for (const f of ['title', 'code', 'details', 'director', 'date', 'rating100']) {
      const pick = fromScene(f);
      const val = pick ? pick[f] : dest[f] || (others.find((s) => s[f]) || {})[f];
      if (val != null && val !== '' && val !== dest[f]) input[f] = val;
    }
    const studio = fromScene('studio');
    const studioId = studio ? studio.studio?.id : dest.studio?.id || others.find((s) => s.studio)?.studio?.id;
    if (studioId && studioId !== dest.studio?.id) input.studio_id = studioId;

    input.performer_ids = uniq(scenes.flatMap((s) => ids(s.performers)));
    input.tag_ids = uniq(scenes.flatMap((s) => ids(s.tags)));
    input.gallery_ids = uniq(scenes.flatMap((s) => ids(s.galleries)));
    input.urls = uniq(scenes.flatMap((s) => s.urls || []));
    const sid = new Map();
    scenes.forEach((s) => (s.stash_ids || []).forEach((x) => sid.set(x.endpoint + '|' + x.stash_id, { endpoint: x.endpoint, stash_id: x.stash_id })));
    input.stash_ids = [...sid.values()];
    const grp = new Map();
    scenes.forEach((s) => (s.groups || []).forEach((g) => grp.has(g.group.id) || grp.set(g.group.id, { group_id: g.group.id, scene_index: g.scene_index })));
    input.groups = [...grp.values()];

    const gone = losers.filter((l) => l.file.id !== keeper.file.id);
    if (gone.length !== losers.length) throw new Error('keeper file is in the delete list');
    return {
      dest,
      update: input,
      mergeSources: others.map((s) => s.id),
      keepFileId: keeper.file.id,
      deleteIds: gone.filter((l) => !l.file.missing_since).map((l) => l.file.id),
      destroyIds: gone.filter((l) => l.file.missing_since).map((l) => l.file.id),
      required: { performers: input.performer_ids, tags: input.tag_ids },
    };
  }

  // Runs the plan. Every mutation goes through `call`; with dry=true nothing is sent.
  async function runPlan(plan, gql, log, dry) {
    const call = async (label, q, v) => {
      log(`${dry ? '[dry run] would run' : 'run'} ${label} ${JSON.stringify(v)}`);
      return dry ? null : gql(q, v);
    };
    await call('sceneUpdate (combine metadata)', Q.update, { input: plan.update });
    if (!dry) {
      const d = (await gql(Q.scenes, { ids: [plan.dest.id] })).findScenes.scenes[0];
      const miss = (have, want) => want.filter((x) => !have.includes(x));
      const lost = [...miss(ids(d.performers), plan.required.performers), ...miss(ids(d.tags), plan.required.tags)];
      if (lost.length) throw new Error(`aborted before any delete: ${lost.length} tag/performer id(s) missing after update: ${lost.join(',')}`);
      log('check ok: all tags and performers are on the destination');
    }
    if (plan.mergeSources.length)
      await call('sceneMerge (history, markers, files)', Q.merge, { input: { source: plan.mergeSources, destination: plan.dest.id, play_history: true, o_history: true } });
    await call('sceneUpdate (primary file)', Q.update, { input: { id: plan.dest.id, primary_file_id: plan.keepFileId } });
    if (plan.deleteIds.length) await call('deleteFiles (from disk)', Q.deleteFiles, { ids: plan.deleteIds });
    if (plan.destroyIds.length) await call('destroyFiles (missing on disk, database only)', Q.destroyFiles, { ids: plan.destroyIds });
    log(dry ? 'dry run done, nothing changed' : 'done');
  }

  const api = { Q, buildPlan, runPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DupPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
