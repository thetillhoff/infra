const test = require('node:test');
const assert = require('node:assert');
const { pickKeeper, findConflicts, unionIds } = require('./rank.js');

let n = 0;
const file = (o) => ({ id: ++n, width: 1280, height: 720, duration: 600, frame_rate: 30, bit_rate: 500000, size: 1e8, audio_codec: 'aac', mod_time: '2026-01-01', ...o });
const scene = (f, o = {}) => ({ id: String(f.id), rating100: 0, files: [f], ...o });
const run = (files, o) => pickKeeper(files.map((f) => scene(f, o)));

test('higher resolution below 1080 wins', () => {
  const a = file({ width: 854, height: 480 }), b = file({});
  const r = run([a, b]);
  assert.equal(r.keeper.file.id, b.id);
  assert.equal(r.manual, null);
});

test('1080p next to 480p resolves to 1080p', () => {
  const a = file({ width: 854, height: 480 }), b = file({ width: 1920, height: 1080 });
  const r = run([a, b]);
  assert.equal(r.keeper.file.id, b.id);
  assert.equal(r.manual, null);
});

test('720p next to 1080p needs a human; target picks the suggestion', () => {
  const a = file({}), b = file({ width: 1920, height: 1080 });
  const low = run([a, b]);
  assert.ok(low.manual);
  assert.equal(low.keeper.file.id, a.id);
  const hi = pickKeeper([scene(a, { rating100: 100 }), scene(b)]);
  assert.ok(hi.manual);
  assert.equal(hi.keeper.file.id, b.id);
});

test('portrait uses the short side', () => {
  const a = file({ width: 720, height: 1280 }), b = file({ width: 480, height: 854 });
  assert.equal(run([a, b]).keeper.file.id, a.id);
});

test('a truncated file loses', () => {
  const a = file({ duration: 100 }), b = file({ duration: 600, bit_rate: 1000 });
  assert.equal(run([a, b]).keeper.file.id, b.id);
});

test('audio beats no audio', () => {
  const a = file({ audio_codec: null }), b = file({});
  assert.equal(run([a, b]).keeper.file.id, b.id);
});

test('frame rate above 30 is a tie; 24 loses to 30', () => {
  const a = file({ frame_rate: 40, size: 3e8 }), b = file({ frame_rate: 30 });
  assert.equal(run([a, b]).keeper.file.id, b.id); // tie on fps, then smaller size
  const c = file({ frame_rate: 24 }), d = file({ frame_rate: 30, size: 9e8 });
  assert.equal(run([c, d]).keeper.file.id, d.id);
});

test('bitrate counts up to the lean limit, then size decides', () => {
  const a = file({ bit_rate: 200000, size: 1e6 }), b = file({ bit_rate: 500000, size: 9e8 });
  assert.equal(run([a, b]).keeper.file.id, b.id); // 200k is starved
  const c = file({ bit_rate: 400000, size: 1e8 }), d = file({ bit_rate: 800000, size: 9e8 });
  assert.equal(run([c, d]).keeper.file.id, c.id); // both enough: smaller wins
});

test('last tiebreakers: older, then lower id', () => {
  const a = file({ mod_time: '2026-03-01' }), b = file({ mod_time: '2026-01-01' });
  assert.equal(run([a, b]).keeper.file.id, b.id);
  const c = file({}), d = file({});
  assert.equal(run([d, c]).keeper.file.id, c.id);
});

test('one scene with several files is ranked per file', () => {
  const a = file({ width: 854, height: 480 }), b = file({});
  const r = pickKeeper([{ id: '1', rating100: 0, files: [a, b] }]);
  assert.equal(r.keeper.file.id, b.id);
  assert.equal(r.losers.length, 1);
});

test('conflicts only when both sides have a different value', () => {
  const k = { id: '1', title: 'A', date: '2020-01-01', rating100: 0, studio: { id: '1', name: 'S' }, performers: [{ id: '1', name: 'P' }] };
  const o = { id: '2', title: 'B', date: '', rating100: 80, studio: null, performers: [{ id: '2', name: 'Q' }] };
  const c = findConflicts(k, [o]).map((x) => x.field).sort();
  assert.deepEqual(c, ['performers', 'title']);
});

test('performers union keeps every id', () => {
  const k = { id: '1', performers: [{ id: '1' }] }, o = { id: '2', performers: [{ id: '2' }, { id: '1' }] };
  assert.deepEqual(unionIds([k, o], 'performers').sort(), ['1', '2']);
});
