// Adds "Keep this" to the rows of Stash's native Scene Duplicate Checker. The page is not patchable,
// so this injects into its DOM. Mutations go through fetch, so the page never refetches its list:
// resolved groups are hidden instead.
(function () {
  'use strict';

  const { pickKeeper, findConflicts } = window.DupRank;
  const { Q, buildPlan, runPlan, runCleanup } = window.DupPlan;
  const ROOT = '#scene-duplicate-checker';
  const cache = new Map(); // scene id -> scene
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => n.append(k));
    return n;
  };

  async function gql(query, variables) {
    const res = await fetch('/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data;
  }

  document.head.append(el('style', { textContent: `
    [data-dm-done] { display: none; }
    .dm-keep { white-space: normal; }
    .dm-multi { margin-top: 2rem; }
    .dm-scene { margin-bottom: 1.5rem; }
    .dm-badge { display: block; font-size: .8em; opacity: .85; }
    .dm-badge.dm-manual { color: #f0ad4e; }
    .dm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 2000; overflow: auto; }
    .dm-modal { background: #30404d; color: #fff; max-width: 900px; margin: 4vh auto; padding: 1.5rem; border-radius: 6px; }
    .dm-modal h5 { margin-top: 1rem; }
    .dm-modal pre { background: #1b2a35; padding: .5rem; max-height: 14rem; overflow: auto; white-space: pre-wrap; }
    .dm-modal .dm-del { color: #ff8a8a; }
    .dm-modal .dm-manual { color: #f0ad4e; }
    .dm-modal label { display: block; }
  ` }));

  // ---- read the groups from the page ----------------------------------------------------------
  function readGroups() {
    const groups = [];
    let cur = null;
    document.querySelectorAll(`${ROOT} table tbody tr`).forEach((tr) => {
      const m = tr.querySelector('a[href^="/scenes/"]')?.getAttribute('href').match(/\/scenes\/(\d+)/);
      if (!m) { cur = null; return; }
      if (!cur || tr.classList.contains('duplicate-group')) groups.push((cur = { rows: [], ids: [] }));
      cur.rows.push(tr);
      cur.ids.push(m[1]);
    });
    return groups;
  }

  async function load(ids) {
    const need = [...new Set(ids)].filter((id) => !cache.has(id)); // one scene can sit in two groups
    if (!need.length) return;
    const data = await gql(Q.scenes, { ids: need });
    data.findScenes.scenes.forEach((s) => cache.set(s.id, s));
  }

  const describe = (c) => {
    const f = c.file;
    return `${f.path} - ${f.width}x${f.height}, ${Math.round(f.frame_rate || 0)} fps, ${Math.round((f.bit_rate || 0) / 1000)} kb/s, ${(f.size / 1e6).toFixed(0)} MB`;
  };

  // ---- annotate -------------------------------------------------------------------------------
  let busy = false;
  // Puts a button next to the native "Missing phashes" warning.
  function ensurePhashButton() {
    const warn = [...document.querySelectorAll(`${ROOT} p.lead`)].find((p) => /phash/i.test(p.textContent));
    if (!warn || warn.querySelector('.dm-phash')) return;
    const btn = el('button', { className: 'btn btn-primary btn-sm dm-phash ml-3', textContent: 'Generate phashes' });
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const id = String((await gql(Q.phash)).metadataGenerate);
        for (;;) {
          const job = ((await gql(Q.jobs)).jobQueue || []).find((j) => j.id === id);
          if (!job) break; // a finished job leaves the queue
          btn.textContent = `Generating phashes... ${Math.round((job.progress || 0) * 100)}%`;
          await new Promise((r) => setTimeout(r, 1500));
        }
        btn.textContent = 'Finished - reload this page';
        btn.disabled = false;
        btn.onclick = () => location.reload();
      } catch (e) {
        btn.textContent = `Failed: ${e.message}`;
        btn.disabled = false;
      }
    };
    warn.append(btn);
  }

  async function annotate() {
    ensureMulti();
    ensurePhashButton();
    if (busy || !document.querySelector(ROOT)) return;
    busy = true;
    try {
      const groups = readGroups().filter((g) => g.rows.some((r) => !r.dataset.dm));
      await load(groups.flatMap((g) => g.ids));
      for (const g of groups) {
        const scenes = g.ids.map((id) => cache.get(id)).filter(Boolean);
        if (scenes.length < 2 || scenes.some((s) => !s.files.length)) continue;
        const auto = pickKeeper(scenes);
        g.rows.forEach((tr, i) => {
          tr.dataset.dm = '1';
          const id = g.ids[i];
          const suggested = !auto.manual && auto.keeper.scene.id === id;
          const ops = tr.querySelector('td:last-child');
          if (!ops || ops.querySelector('[data-dm-keep]')) return;
          const label = suggested ? `Keep (${auto.trail.join(', ') || 'suggested'})` : 'Keep this';
          ops.append(el('button', { className: `btn ${suggested ? 'btn-success' : 'btn-secondary'} edit-button dm-keep`, textContent: label, onclick: () => openModal(g, scenes, id) }));
          ops.lastElementChild.dataset.dmKeep = id;
          if (auto.manual && i === 0) ops.append(el('span', { className: 'dm-badge dm-manual', textContent: `no suggestion: ${auto.manual}` }));
        });
      }
    } catch (e) {
      console.error('duplicate-merger', e);
    } finally {
      busy = false;
    }
  }

  // ---- confirm dialog -------------------------------------------------------------------------
  function openModal(group, scenes, chosenSceneId) {
    const auto = pickKeeper(scenes);
    const chosen = scenes.find((s) => s.id === chosenSceneId);
    const keeper = chosen.id === auto.keeper.scene.id ? auto.keeper : pickKeeper([chosen]).keeper;
    const all = scenes.flatMap((scene) => scene.files.map((file) => ({ scene, file })));
    const losers = all.filter((c) => c.file.id !== keeper.file.id);
    const conflicts = findConflicts(keeper.scene, scenes.filter((s) => s.id !== keeper.scene.id));
    const choices = {};

    const close = () => overlay.remove();
    const log = el('pre', { textContent: '' });
    const review = el('input', { type: 'checkbox' });
    const run = el('button', { className: 'btn btn-danger', textContent: 'Merge and delete the others' });
    const needReview = conflicts.length; // picking the file is the choice for a 720p/1080p group
    run.disabled = !!needReview;
    review.onchange = () => (run.disabled = !review.checked);

    const conflictUi = conflicts.map((c) => {
      if (c.field === 'performers') return el('div', {}, el('b', { textContent: 'performers differ - all of them are kept: ' }), c.values.map((v) => `scene ${v.scene}: ${v.value}; `).join(''));
      choices[c.field] = keeper.scene.id;
      return el('div', {}, el('b', { textContent: `${c.field} differs:` }),
        c.values.map((v) => el('label', {}, el('input', { type: 'radio', name: `dm-${c.field}`, checked: v.scene === keeper.scene.id, onchange: () => (choices[c.field] = v.scene) }), ` scene ${v.scene}: ${String(v.value)}`)));
    });

    run.onclick = async () => {
      run.disabled = true;
      log.textContent = '';
      try {
        const plan = buildPlan(scenes, keeper, losers, conflicts, choices);
        await runPlan(plan, gql, (m) => (log.textContent += m + '\n'), false);
        group.rows.forEach((tr) => (tr.dataset.dmDone = '1'));
        scenes.forEach((s) => cache.delete(s.id));
      } catch (e) {
        log.textContent += `ERROR: ${e.message}\n`;
        run.disabled = false; // a failed run stopped before any delete, so it can be retried
      }
    };

    const overlay = el('div', { className: 'dm-overlay' }, el('div', { className: 'dm-modal' },
      el('h4', { textContent: 'Merge into the kept file, delete the rest' }),
      auto.manual ? el('p', { className: 'dm-manual', textContent: `Check this group: ${auto.manual}.` }) : '',
      el('h5', { textContent: 'Keep' }), el('div', { textContent: describe(keeper) }),
      el('h5', { textContent: 'Delete' }), losers.map((c) => el('div', { className: 'dm-del', textContent: describe(c) })),
      conflicts.length ? [el('h5', { textContent: 'Values that differ' }), conflictUi] : '',
      needReview ? el('label', {}, review, ' I checked the choices above') : '',
      el('div', { style: 'margin-top:1rem' }, run, ' ', el('button', { className: 'btn btn-secondary', textContent: 'Close', onclick: close })),
      log));
    document.body.append(overlay);
  }

  // ---- scenes that already hold several files: a section below the native table --------------------
  const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`;

  function openCleanupModal(scene, keepFileId) {
    const keep = scene.files.find((f) => f.id === keepFileId);
    const log = el('pre', { textContent: '' });
    const run = el('button', { className: 'btn btn-danger', textContent: 'Delete the others' });
    run.onclick = async () => {
      run.disabled = true;
      try {
        await runCleanup(scene, keepFileId, gql, (m) => (log.textContent += m + '\n'));
        cache.delete(scene.id);
        document.querySelector(`[data-dm-scene="${scene.id}"]`)?.remove();
      } catch (e) {
        log.textContent += `ERROR: ${e.message}\n`;
        run.disabled = false;
      }
    };
    const overlay = el('div', { className: 'dm-overlay' }, el('div', { className: 'dm-modal' },
      el('h4', { textContent: `Scene ${scene.id}: keep one file` }),
      el('h5', { textContent: 'Keep' }), el('div', { textContent: describe({ file: keep }) }),
      el('h5', { textContent: 'Delete' }), scene.files.filter((f) => f.id !== keepFileId).map((f) => el('div', { className: 'dm-del', textContent: describe({ file: f }) })),
      el('div', { style: 'margin-top:1rem' }, run, ' ', el('button', { className: 'btn btn-secondary', textContent: 'Close', onclick: () => overlay.remove() })),
      log));
    document.body.append(overlay);
  }

  function sceneBlock(scene) {
    const auto = pickKeeper([scene]);
    const suggestedId = auto.manual ? null : auto.keeper.file.id;
    const rows = scene.files.map((f) => {
      const isSuggested = f.id === suggestedId;
      return el('tr', {},
        el('td', {}, el('div', { textContent: f.basename }), el('small', { textContent: f.path })),
        el('td', { textContent: fmtDur(f.duration) }),
        el('td', { textContent: `${f.width}x${f.height}` }),
        el('td', { textContent: `${Math.round(f.frame_rate || 0)} fps` }),
        el('td', { textContent: `${Math.round((f.bit_rate || 0) / 1000)} kb/s` }),
        el('td', { textContent: `${(f.size / 1e6).toFixed(0)} MB` }),
        el('td', {}, el('button', { className: `btn ${isSuggested ? 'btn-success' : 'btn-secondary'} edit-button dm-keep`, textContent: isSuggested ? `Keep (${auto.trail.join(', ') || 'suggested'})` : 'Keep this', onclick: () => openCleanupModal(scene, f.id) })));
    });
    const block = el('div', { className: 'dm-scene' },
      el('h6', { textContent: `Scene ${scene.id}${scene.title ? ' - ' + scene.title : ''}` }),
      auto.manual ? el('div', { className: 'dm-badge dm-manual', textContent: `no suggestion: ${auto.manual}` }) : '',
      el('table', { className: 'table table-sm' }, el('tbody', {}, rows)));
    block.dataset.dmScene = scene.id;
    return block;
  }

  let multiBusy = false;
  async function ensureMulti() {
    const root = document.querySelector(ROOT);
    if (!root || multiBusy || root.querySelector('.dm-multi')) return;
    multiBusy = true;
    try {
      const scenes = (await gql(Q.multi)).findScenes.scenes;
      if (root.querySelector('.dm-multi')) return;
      const head = scenes.length ? [el('h5', { textContent: `Scenes that hold several files (${scenes.length})` })] : [];
      root.append(el('div', { className: 'dm-multi' }, head, scenes.map(sceneBlock)));
    } catch (e) {
      console.error('duplicate-merger', e);
    } finally {
      multiBusy = false;
    }
  }

  new MutationObserver(() => requestAnimationFrame(annotate)).observe(document.body, { childList: true, subtree: true });
})();
