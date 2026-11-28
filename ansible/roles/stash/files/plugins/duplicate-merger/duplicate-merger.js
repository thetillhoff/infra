// Adds "Keep this" to the rows of Stash's native Scene Duplicate Checker. The page is not patchable,
// so this injects into its DOM. Mutations go through fetch, so the page never refetches its list:
// resolved groups are hidden instead.
(function () {
  'use strict';

  const { pickKeeper, findConflicts } = window.DupRank;
  const { Q, buildPlan, runPlan, buildCleanup, runCleanup } = window.DupPlan;
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
    const need = ids.filter((id) => !cache.has(id));
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
  function ensureBar() {
    const root = document.querySelector(ROOT);
    if (!root || root.querySelector('.dm-bar')) return;
    root.prepend(el('div', { className: 'dm-bar' }, el('button', { className: 'btn btn-secondary', textContent: 'Clean up scenes that hold several files', onclick: openCleanup })));
  }

  async function annotate() {
    ensureBar();
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
          const isKeeper = auto.keeper.scene.id === id;
          const ops = tr.querySelector('td:last-child');
          if (!ops || ops.querySelector('[data-dm-keep]')) return;
          ops.append(el('button', { className: `btn ${isKeeper ? 'btn-success' : 'btn-secondary'} edit-button`, textContent: isKeeper ? 'Keep (suggested)' : 'Keep this', onclick: () => openModal(g, scenes, id) }));
          ops.lastElementChild.dataset.dmKeep = id;
          if (isKeeper) {
            const title = tr.querySelector('td.text-left') || tr.children[2];
            title?.append(el('span', { className: `dm-badge${auto.manual ? ' dm-manual' : ''}`, textContent: auto.manual ? `needs your choice: ${auto.manual}` : `suggested keeper (${auto.trail.join(', ') || 'only candidate'})` }));
          }
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
    const dry = el('input', { type: 'checkbox', checked: true });
    const review = el('input', { type: 'checkbox' });
    const run = el('button', { className: 'btn btn-danger', textContent: 'Run' });
    const needReview = auto.manual || conflicts.length;
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
        await runPlan(plan, gql, (m) => (log.textContent += m + '\n'), dry.checked);
        if (!dry.checked) {
          group.rows.forEach((tr) => (tr.dataset.dmDone = '1'));
          scenes.forEach((s) => cache.delete(s.id));
        }
      } catch (e) {
        log.textContent += `ERROR: ${e.message}\n`;
      }
      run.disabled = !dry.checked;
    };

    const overlay = el('div', { className: 'dm-overlay' }, el('div', { className: 'dm-modal' },
      el('h4', { textContent: 'Merge into the kept file, delete the rest' }),
      auto.manual ? el('p', { className: 'dm-manual', textContent: `Check this group: ${auto.manual}.` }) : '',
      el('h5', { textContent: 'Keep' }), el('div', { textContent: describe(keeper) }),
      el('h5', { textContent: 'Delete' }), losers.map((c) => el('div', { className: 'dm-del', textContent: describe(c) })),
      conflicts.length ? [el('h5', { textContent: 'Values that differ' }), conflictUi] : '',
      needReview ? el('label', {}, review, ' I checked the choices above') : '',
      el('label', {}, dry, ' Dry run (nothing is changed)'),
      el('div', { style: 'margin-top:1rem' }, run, ' ', el('button', { className: 'btn btn-secondary', textContent: 'Close', onclick: close })),
      log));
    document.body.append(overlay);
  }

  // ---- clean up scenes that already hold several files ------------------------------------------
  async function openCleanup() {
    const scenes = (await gql(Q.multi)).findScenes.scenes;
    const items = scenes.map((s) => buildCleanup(s, pickKeeper([s])));
    const log = el('pre', { textContent: '' });
    const dry = el('input', { type: 'checkbox', checked: true });
    const run = el('button', { className: 'btn btn-danger', textContent: 'Run' });
    const todo = items.filter((i) => !i.manual);
    run.disabled = !todo.length;
    run.onclick = async () => {
      run.disabled = true;
      log.textContent = '';
      try {
        await runCleanup(items, gql, (m) => (log.textContent += m + '\n'), dry.checked);
        if (!dry.checked) scenes.forEach((s) => cache.delete(s.id));
      } catch (e) {
        log.textContent += `ERROR: ${e.message}\n`;
      }
      run.disabled = !dry.checked; // a dry run can be followed by the real one
    };
    const rows = items.map((i) => el('div', { className: i.manual ? 'dm-manual' : '' },
      el('b', { textContent: `scene ${i.scene.id} ${i.scene.title || ''}` }),
      i.manual ? ` - needs your choice, skipped: ${i.manual}` : '',
      i.scene.files.map((f) => {
        const label = i.manual ? 'file' : f.id === i.keepFileId ? 'keep' : 'delete';
        return el('div', { className: label === 'delete' ? 'dm-del' : '', textContent: `${label}: ${describe({ file: f })}` });
      })));
    const overlay = el('div', { className: 'dm-overlay' }, el('div', { className: 'dm-modal' },
      el('h4', { textContent: `${items.length} scene(s) hold several files` }),
      rows,
      el('label', {}, dry, ' Dry run (nothing is changed)'),
      el('div', { style: 'margin-top:1rem' }, run, ' ', el('button', { className: 'btn btn-secondary', textContent: 'Close', onclick: () => overlay.remove() })),
      log));
    document.body.append(overlay);
  }

  new MutationObserver(() => requestAnimationFrame(annotate)).observe(document.body, { childList: true, subtree: true });
})();
