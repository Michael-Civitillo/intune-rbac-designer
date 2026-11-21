// ── Reviewing roles: summary, built-in starting points, compare, "who has?" ────

// ── Role summary ──────────────────────────────────────────────────────────────
function openSummaryDialog(role) {
  const totalSelected = role.permissions.size;
  const highImpact    = highImpactKeys(role).length;
  const findings      = runChecks(role, roles);
  const catsUsed      = PERMISSIONS_DATA.filter(cat =>
    cat.permissions.some(p => role.permissions.has(permKey(cat.category, p.action)))
  );
  const group = groups.find(g => g.id === role.groupId);

  const dialog = openDialog({
    eyebrow: 'Role summary',
    title: role.name || 'Unnamed role',
    body: `
      <div class="summary-stats">
        <div class="stat-card"><div class="stat-num">${totalSelected}</div><div class="stat-label">${totalSelected === 1 ? 'Permission' : 'Permissions'}</div></div>
        <div class="stat-card"><div class="stat-num">${catsUsed.length}</div><div class="stat-label">${catsUsed.length === 1 ? 'Category' : 'Categories'}</div></div>
        <div class="stat-card${highImpact ? ' warn' : ''}"><div class="stat-num">${highImpact}</div><div class="stat-label">High impact</div></div>
      </div>
      ${group ? `<p class="summary-folder">${FOLDER_ICON(13)} ${escHtml(group.name)}</p>` : ''}
      ${role.description.trim() ? `<p class="summary-description">${escHtml(role.description)}</p>` : ''}
      ${findings.length ? `<button class="summary-checks" id="summary-open-checks">${icon(ICON.alert, 14, 'stroke-width="2.3"')}${plural(findings.length, 'thing', 'things')} to check in this role</button>` : ''}
      ${totalSelected === 0 ? '<p class="summary-empty">No permissions selected for this role yet.</p>' : ''}
      ${catsUsed.length > 0 ? `
      <div class="summary-section">
        <h3>Selected permissions by category</h3>
        ${catsUsed.map(cat => {
          const selected = cat.permissions.filter(p => role.permissions.has(permKey(cat.category, p.action)));
          const noted = selected.filter(p => role.notes[permKey(cat.category, p.action)]);
          return `<div class="summary-cat">
            <div class="summary-cat-name">${escHtml(cat.category)}<span class="summary-cat-count">${selected.length} of ${cat.permissions.length}</span></div>
            <div class="summary-perms">${selected.map(p =>
              `<span class="perm-chip${isDestructive(cat.category, p.action) ? ' warn' : ''}">${escHtml(p.action)}</span>`).join('')}</div>
            ${noted.length ? `<ul class="summary-notes">${noted.map(p =>
              `<li><strong>${escHtml(p.action)}:</strong> ${escHtml(role.notes[permKey(cat.category, p.action)])}</li>`).join('')}</ul>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}
      ${role.assignments.length ? `
      <div class="summary-section">
        <h3>Planned assignments</h3>
        ${role.assignments.map(a => `<div class="summary-cat">
          <div class="summary-cat-name">${escHtml(a.name || 'Unnamed assignment')}</div>
          <dl class="summary-assignment">
            <dt>Admin Groups</dt><dd>${escHtml(a.adminGroups.join(', ') || 'None yet')}</dd>
            <dt>Scope (Groups)</dt><dd>${escHtml(a.scopeGroups.join(', ') || 'None yet')}</dd>
            <dt>Scope (Tags)</dt><dd>${escHtml(a.scopeTags.join(', ') || 'None')}</dd>
            ${a.description.trim() ? `<dt>Description</dt><dd>${escHtml(a.description)}</dd>` : ''}
          </dl>
        </div>`).join('')}
      </div>` : ''}`,
  });

  dialog.body.querySelector('#summary-open-checks')?.addEventListener('click', () => openChecksDialog(role));
}

// ── Start from a built-in role ────────────────────────────────────────────────
function builtInKeys(template) {
  return Object.entries(template.permissions).flatMap(([category, actions]) => actions.map(a => permKey(category, a)));
}

function createRoleFromBuiltIn(template) {
  const role = addRole(makeRole({
    name: `${template.name} (custom)`,
    description: `Based on Microsoft's built-in ${template.name} role.`,
    permissions: new Set(builtInKeys(template)),
    // Anything Microsoft added after its built-in role reference was written is worth a look
    reviewed: BUILT_IN_ROLES_DATE,
  }));
  showToast(`Created from ${template.name}. Untick what this role doesn't need.`, 'success');
  return role;
}

function openBuiltInDialog() {
  const dialog = openDialog({
    eyebrow: 'New role',
    title: 'Start from a built-in role',
    size: 'lg',
    footer: '<button class="btn btn-secondary" data-close>Cancel</button>',
    body: `
      <p class="dialog-lead">Pick the Microsoft role closest to what you need. You get an editable copy with the same permissions, ready to trim down. Permission lists are from Microsoft's reference of ${escHtml(formatDate(BUILT_IN_ROLES_DATE))}.</p>
      <div class="template-list">
        ${BUILT_IN_ROLES.map((t, i) => {
          const keys = builtInKeys(t);
          return `<button class="template-card" data-index="${i}">
            <span class="template-name">${escHtml(t.name)}</span>
            <span class="template-desc">${escHtml(t.description)}</span>
            <span class="template-meta">${plural(keys.length, 'permission', 'permissions')} in ${plural(Object.keys(t.permissions).length, 'category', 'categories')}</span>
          </button>`;
        }).join('')}
      </div>`,
  });

  dialog.body.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      closeDialog();
      createRoleFromBuiltIn(BUILT_IN_ROLES[Number(card.dataset.index)]);
    });
  });
}

// ── Compare roles ─────────────────────────────────────────────────────────────
let compareIds      = null;  // Set of role ids picked for comparison; null until first opened
let compareDiffOnly = true;

function defaultCompareIds() {
  if (roles.length <= 6) return new Set(roles.map(r => r.id));
  const active = getActiveRole();
  const peers  = active ? roles.filter(r => r.groupId === active.groupId) : [];
  return new Set((peers.length >= 2 ? peers : roles.slice(0, 4)).map(r => r.id));
}

// Rows the chosen roles disagree on, and rows they all share
function compareRows(chosen) {
  const sections = [];
  let differing = 0, shared = 0;
  PERMISSIONS_DATA.forEach(cat => {
    const rows = [];
    cat.permissions.forEach(p => {
      const key   = permKey(cat.category, p.action);
      const cells = chosen.map(r => r.permissions.has(key));
      const count = cells.filter(Boolean).length;
      if (count === 0) return;               // nobody has it: nothing to compare
      const differs = count !== chosen.length;
      differs ? differing++ : shared++;
      rows.push({ category: cat.category, action: p.action, cells, differs });
    });
    if (rows.length) sections.push({ category: cat.category, rows });
  });
  return { sections, differing, shared };
}

function openCompareDialog() {
  if (roles.length < 2) {
    showToast('Create at least two roles to compare them.', 'error');
    return;
  }
  if (!compareIds) compareIds = defaultCompareIds();
  // Drop roles that have since been deleted
  compareIds = new Set([...compareIds].filter(id => roles.some(r => r.id === id)));
  if (compareIds.size < 2) compareIds = defaultCompareIds();

  const dialog = openDialog({
    eyebrow: 'Review',
    title: 'Compare roles',
    size: 'xl',
    body: '<div id="compare-root"></div>',
  });
  const root = dialog.body.querySelector('#compare-root');

  function draw() {
    const chosen = roles.filter(r => compareIds.has(r.id));
    const { sections, differing, shared } = compareRows(chosen);
    const visible = sections
      .map(s => ({ ...s, rows: compareDiffOnly ? s.rows.filter(r => r.differs) : s.rows }))
      .filter(s => s.rows.length);

    root.innerHTML = `
      <div class="compare-controls">
        <div class="compare-pick" role="group" aria-label="Roles to compare">
          ${roles.map(r => `<button class="chip-toggle${compareIds.has(r.id) ? ' on' : ''}" data-id="${escAttr(r.id)}" aria-pressed="${compareIds.has(r.id)}">
            <span class="role-icon ${hueClass(r.id)}">${escHtml(initials(r.name))}</span>${escHtml(r.name || 'Unnamed role')}</button>`).join('')}
        </div>
        <div class="compare-options">
          <label class="switch" title="Hide permissions that every chosen role has">
            <input type="checkbox" id="compare-diff-only" ${compareDiffOnly ? 'checked' : ''}/>
            <span class="switch-track"></span>
            <span>Differences only</span>
          </label>
          <span class="compare-count" id="compare-count">${chosen.length < 2 ? '' : `${plural(differing, 'difference', 'differences')} · ${shared} shared by all`}</span>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-secondary btn-sm" id="compare-export" ${chosen.length < 2 ? 'disabled' : ''}>${icon(ICON.download, 14)} Save as image</button>
        </div>
      </div>
      ${chosen.length < 2
        ? '<div class="compare-empty">Pick at least two roles above.</div>'
        : visible.length === 0
          ? `<div class="compare-empty">${compareDiffOnly && shared ? 'These roles grant exactly the same permissions.' : 'None of these roles has any permissions yet.'}</div>`
          : `<div class="compare-table-wrap"><table class="compare-table">
              <thead><tr>
                <th class="compare-perm-head">Permission</th>
                ${chosen.map(r => `<th class="compare-role-head" title="${escAttr(r.name)}"><span>${escHtml(r.name || 'Unnamed role')}</span><em>${r.permissions.size}</em></th>`).join('')}
              </tr></thead>
              <tbody>
                ${visible.map(s => `
                  <tr class="compare-cat"><th colspan="${chosen.length + 1}">${escHtml(s.category)}</th></tr>
                  ${s.rows.map(row => `<tr class="${row.differs ? 'differs' : ''}">
                    <td class="compare-perm">${escHtml(row.action)}${isDestructive(row.category, row.action) ? `<span class="perm-flag">${icon(ICON.alert, 11, 'stroke-width="2.4"')}High impact</span>` : ''}</td>
                    ${row.cells.map(on => `<td class="compare-cell${on ? ' yes' : ''}">${on ? icon(ICON.check, 15, 'stroke-width="2.8"') : ''}</td>`).join('')}
                  </tr>`).join('')}`).join('')}
              </tbody>
            </table></div>`}`;

    root.querySelectorAll('.chip-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        compareIds.has(btn.dataset.id) ? compareIds.delete(btn.dataset.id) : compareIds.add(btn.dataset.id);
        draw();
      });
    });
    root.querySelector('#compare-diff-only').addEventListener('change', e => {
      compareDiffOnly = e.target.checked;
      draw();
    });
    root.querySelector('#compare-export').addEventListener('click', () => exportComparisonImage(chosen));
  }

  draw();
}

// ── Who has a permission? ─────────────────────────────────────────────────────
function openFindDialog() {
  const dialog = openDialog({
    eyebrow: 'Review',
    title: 'Who has a permission?',
    size: 'lg',
    body: `
      <div class="find-controls">
        <div class="search-wrap">
          ${icon(ICON.search, 15, 'class="search-icon"')}
          <input class="search-input" type="text" id="find-input" placeholder="Search for a permission, for example wipe" aria-label="Search for a permission" autocomplete="off" spellcheck="false"/>
        </div>
        <label class="switch">
          <input type="checkbox" id="find-high-impact"/>
          <span class="switch-track"></span>
          <span>High impact only</span>
        </label>
      </div>
      <p class="find-status" id="find-status" role="status"></p>
      <div class="find-results" id="find-results"></div>`,
  });

  const input   = dialog.body.querySelector('#find-input');
  const impact  = dialog.body.querySelector('#find-high-impact');
  const results = dialog.body.querySelector('#find-results');
  const status  = dialog.body.querySelector('#find-status');

  function draw() {
    const q = input.value.toLowerCase().trim();
    let matches = 0, granted = 0;
    const sections = PERMISSIONS_DATA.map(cat => {
      const catMatches = !!q && cat.category.toLowerCase().includes(q);
      const rows = cat.permissions.map(p => {
        const key     = permKey(cat.category, p.action);
        const holders = roles.filter(r => r.permissions.has(key));
        const textOk  = !q ? holders.length > 0   // with no search, list what is actually granted
          : catMatches || p.action.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        if (!textOk || (impact.checked && !isDestructive(cat.category, p.action))) return null;
        matches++;
        if (holders.length) granted++;
        return { p, holders };
      }).filter(Boolean);
      return { category: cat.category, rows };
    }).filter(s => s.rows.length);

    status.textContent = !roles.length ? 'There are no roles yet.'
      : !q ? (matches
          ? `${plural(matches, 'permission is', 'permissions are')} granted by at least one role. Search to look up any other.`
          : impact.checked ? 'No role grants a high-impact permission.' : 'No role grants any permission yet. Search to look one up.')
      : matches ? `${plural(matches, 'permission matches', 'permissions match')}; ${granted} granted by at least one role.`
      : `Nothing matches "${input.value.trim()}".`;

    results.innerHTML = sections.map(s => `
      <div class="find-cat">${highlight(s.category, q)}</div>
      ${s.rows.map(({ p, holders }) => `
        <div class="find-row">
          <div class="find-perm">
            <span class="find-name"><span>${highlight(p.action, q)}</span>${isDestructive(s.category, p.action) ? `<span class="perm-flag">${icon(ICON.alert, 11, 'stroke-width="2.4"')}High impact</span>` : ''}</span>
            <span class="find-desc">${highlight(p.description, q)}</span>
          </div>
          <div class="find-holders">
            ${holders.length
              ? `<span class="find-count">${holders.length} of ${roles.length}</span>` + holders.map(r =>
                  `<button class="holder-chip" data-role="${escAttr(r.id)}" data-category="${escAttr(s.category)}" data-action="${escAttr(p.action)}" title="Open ${escAttr(r.name)} at this permission"><span class="role-icon ${hueClass(r.id)}">${escHtml(initials(r.name))}</span>${escHtml(r.name || 'Unnamed role')}</button>`).join('')
              : '<span class="find-none">No role</span>'}
          </div>
        </div>`).join('')}`).join('');

    results.querySelectorAll('.holder-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        closeDialog();
        showRolePermission(chip.dataset.role, chip.dataset.category, chip.dataset.action);
      });
    });
  }

  input.addEventListener('input', draw);
  impact.addEventListener('change', draw);
  draw();
  input.focus();
}
