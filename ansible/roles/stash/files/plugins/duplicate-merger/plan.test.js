const test = require('node:test');
const assert = require('node:assert');
const { Q, buildPlan, runPlan } = require('./plan.js');
const { pickKeeper, findConflicts } = require('./rank.js');

const f = (id, o = {}) => ({ id, width: 1280, height: 720, duration: 600, frame_rate: 30, bit_rate: 500000, size: 1e8, audio_codec: 'aac', mod_time: '2026-01-01', missing_since: null, ...o });
const sc = (id, files, o = {}) => ({ id, title: '', rating100: 0, studio: null, performers: [], tags: [], galleries: [], urls: [], stash_ids: [], groups: [], files, ...o });

function setup(overrides = {}) {
  const good = sc('1', [f('10')], { tags: [{ id: 't1' }], performers: [{ id: 'p1', name: 'P' }], ...overrides.good });
  const bad = sc('2', [f('20', { width: 854, height: 480 }), f('21', { missing_since: 'x' })], { tags: [{ id: 't2' }], performers: [{ id: 'p2', name: 'Q' }], title: 'T', ...overrides.bad });
  const scenes = [good, bad];
  const r = pickKeeper(scenes);
  const conflicts = findConflicts(r.keeper.scene, scenes.filter((s) => s !== r.keeper.scene));
  return { scenes, r, conflicts };
}

function fakeGql({ dropTag } = {}) {
  const calls = [];
  const gql = async (q, v) => {
    const name = Object.entries(Q).find(([, s]) => s === q)[0];
    calls.push([name, v]);
    if (name === 'scenes') return { findScenes: { scenes: [{ id: '1', tags: dropTag ? [{ id: 't1' }] : [{ id: 't1' }, { id: 't2' }], performers: [{ id: 'p1' }, { id: 'p2' }] }] } };
    return {};
  };
  return { gql, calls };
}

test('plan: keeper is the 720p file; the others are deleted or destroyed', () => {
  const { scenes, r, conflicts } = setup();
  const p = buildPlan(scenes, r.keeper, r.losers, conflicts);
  assert.equal(p.dest.id, '1');
  assert.deepEqual(p.deleteIds, ['20']);
  assert.deepEqual(p.destroyIds, ['21']);
  assert.deepEqual(p.update.tag_ids.sort(), ['t1', 't2']);
  assert.deepEqual(p.update.performer_ids.sort(), ['p1', 'p2']);
  assert.equal(p.update.title, 'T'); // destination has none, so the other one fills in
});

test('real run: update, check, merge, primary, deleteFiles, destroyFiles - in that order', async () => {
  const { scenes, r, conflicts } = setup();
  const { gql, calls } = fakeGql();
  await runPlan(buildPlan(scenes, r.keeper, r.losers, conflicts), gql, () => {}, false);
  assert.deepEqual(calls.map((c) => c[0]), ['update', 'scenes', 'merge', 'update', 'deleteFiles', 'destroyFiles']);
  assert.deepEqual(calls[3][1].input, { id: '1', primary_file_id: '10' });
});

test('dry run sends nothing', async () => {
  const { scenes, r, conflicts } = setup();
  const { gql, calls } = fakeGql();
  const out = [];
  await runPlan(buildPlan(scenes, r.keeper, r.losers, conflicts), gql, (m) => out.push(m), true);
  assert.equal(calls.length, 0);
  assert.ok(out.some((m) => m.includes('would run deleteFiles')));
});

test('a tag missing after the update aborts before merge and delete', async () => {
  const { scenes, r, conflicts } = setup();
  const { gql, calls } = fakeGql({ dropTag: true });
  await assert.rejects(runPlan(buildPlan(scenes, r.keeper, r.losers, conflicts), gql, () => {}, false), /aborted before any delete/);
  assert.deepEqual(calls.map((c) => c[0]), ['update', 'scenes']);
});

test('a chosen value wins a single-value conflict', () => {
  const { scenes, r, conflicts } = setup({ good: { title: 'Mine' } });
  assert.ok(conflicts.some((c) => c.field === 'title'));
  const p = buildPlan(scenes, r.keeper, r.losers, conflicts, { title: '2' });
  assert.equal(p.update.title, 'T');
  const q = buildPlan(scenes, r.keeper, r.losers, conflicts, {});
  assert.equal(q.update.title, undefined); // no choice: destination keeps its own
});

test('the keeper file can never be in the delete list', () => {
  const { scenes, r, conflicts } = setup();
  assert.throws(() => buildPlan(scenes, r.keeper, [...r.losers, r.keeper], conflicts), /keeper file/);
});
