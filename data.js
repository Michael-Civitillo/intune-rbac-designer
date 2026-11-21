// ── Backup, restore, and the bridge to Intune ─────────────────────────────────
//
// Three kinds of JSON can be brought in, and the app tells them apart by shape:
//   - a backup made by this app (or a raw copy of its saved data)
//   - Intune's permission IDs: GET /deviceManagement/resourceOperations
//   - roles from a tenant:     GET /deviceManagement/roleDefinitions
//
// Intune identifies every permission by an internal ID that Microsoft does not publish as a
// list. Those IDs are needed both to create a role in Intune and to read roles exported from
// it, so they are learned once from the tenant's own resourceOperations export and kept
// locally.

const GRAPH_IDS_KEY  = 'intuneRbacGraphIds';
const GRAPH_BASE     = 'https://graph.microsoft.com/beta/deviceManagement';
const IMPORT_FOLDER  = 'Imported from Intune';

// ids: permKey -> Intune resource action ID
let graphIds = { ids: {}, loadedAt: null, source: '', unknown: 0 };

function loadGraphIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(GRAPH_IDS_KEY));
    if (saved && saved.ids && typeof saved.ids === 'object') {
      graphIds = { ids: saved.ids, loadedAt: saved.loadedAt || null, source: saved.source || '', unknown: saved.unknown || 0 };
    }
  } catch { /* keep the empty default */ }
}

function saveGraphIds() { localStorage.setItem(GRAPH_IDS_KEY, JSON.stringify(graphIds)); }

function graphIdCount() {
  let n = 0;
  PERM_INDEX.forEach((_perm, key) => { if (graphIds.ids[key]) n++; });
  return n;
}

// ── Matching Intune's names to the permission list ────────────────────────────
function normName(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

const CATALOG_BY_NAME = new Map();   // "category|action" -> permKey
const CATALOG_BY_DESC = new Map();   // "category|description" -> permKey (fallback)
PERM_INDEX.forEach((perm, key) => {
  CATALOG_BY_NAME.set(`${normName(perm.category)}|${normName(perm.action)}`, key);
  CATALOG_BY_DESC.set(`${normName(perm.category)}|${normName(perm.description)}`, key);
});
// A tenant may still use a name Microsoft has since changed
PERMISSION_RENAMES.forEach(({ category, from, to }) => {
  const oldName = `${normName(category)}|${normName(from)}`;
  if (!CATALOG_BY_NAME.has(oldName)) CATALOG_BY_NAME.set(oldName, permKey(category, to));
});

// Graph answers either { value: [...] } or, after some tooling, a bare array or one object
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  return data && typeof data === 'object' ? [data] : [];
}

function readResourceOperations(data) {
  const ids = {};
  const unknown = [];
  asList(data).forEach(op => {
    if (!op || !op.id) return;
    const category = op.resourceName || op.resource;
    const key = CATALOG_BY_NAME.get(`${normName(category)}|${normName(op.actionName)}`)
             || CATALOG_BY_DESC.get(`${normName(category)}|${normName(op.description)}`);
    if (key) ids[key] = String(op.id);
    else unknown.push(`${category || '?'} – ${op.actionName || op.id}`);
  });
  return { ids, unknown, incomplete: !!(data && data['@odata.nextLink']) };
}

// ── Recognising what a file is ────────────────────────────────────────────────
function detectImport(data) {
  if (!data || typeof data !== 'object') return 'unknown';
  const looksLikeRoles = list => Array.isArray(list) && list.some(r => r && typeof r === 'object' && Array.isArray(r.permissions) && 'name' in r);
  if (!Array.isArray(data) && data.app === 'intune-rbac-designer' && Array.isArray(data.roles)) return 'backup';
  if (!Array.isArray(data) && looksLikeRoles(data.roles)) return 'backup';   // a raw copy of this app's saved data
  if (Array.isArray(data) && data.length && looksLikeRoles(data)) return 'backup'; // the oldest saved format

  const list = asList(data);
  if (list.length && list.every(x => x && typeof x.actionName === 'string' && ('resourceName' in x || 'resource' in x))) return 'resourceOperations';
  if (list.length && list.some(x => x && typeof x.displayName === 'string' && (Array.isArray(x.rolePermissions) || Array.isArray(x.permissions)))) return 'roleDefinitions';
  return 'unknown';
}

function parseJson(text) {
  return JSON.parse(String(text).replace(/^﻿/, '').trim());
}

// ── Backup and restore ────────────────────────────────────────────────────────
function buildBackup() {
  return {
    app: 'intune-rbac-designer',
    kind: 'backup',
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    catalogDate: CATALOG_DATE,
    groups: groups.map(g => ({ id: g.id, name: g.name, collapsed: !!g.collapsed })),
    roles: roles.map(serializeRole),
  };
}

function saveBackupFile() {
  downloadFile(`Intune-RBAC-Designer-backup-${todayStamp()}.json`, JSON.stringify(buildBackup(), null, 2));
  showToast('Backup saved.', 'success');
}

// A backup is someone else's file as far as the app is concerned: everything in it goes
// through the same checks as saved data (see reviveRole), and ids are never taken on trust.
function readBackup(data) {
  const revived = reviveAll(data);
  return {
    exportedAt: !Array.isArray(data) && typeof data.exportedAt === 'string' ? data.exportedAt : null,
    groups: revived.groups,
    roles: revived.roles,
    skipped: revived.skipped,
  };
}

// Puts the app back exactly as it was before a restore or import
function snapshotState() {
  const saved = { groups: groups.map(g => ({ ...g })), roles: roles.slice(), active: activeRoleId };
  return () => {
    groups = saved.groups;
    roles  = saved.roles;
    activeRoleId = saved.active;
    saveState();
    render();
  };
}

function restoreBackup(backup, mode) {
  const undo = snapshotState();
  if (mode === 'replace') {
    groups = backup.groups;
    roles  = backup.roles;
  } else {
    // Add alongside what is here: folders are matched by name, roles always arrive as new ones
    const folderFor = new Map(backup.groups.map(g => [g.id, ensureGroup(g.name).id]));
    backup.roles.forEach(r => roles.push({ ...r, id: uid(), groupId: folderFor.get(r.groupId) || null }));
  }
  activeRoleId = (mode === 'replace' ? roles[0] : roles[roles.length - backup.roles.length])?.id || activeRoleId;
  searchQuery = ''; filterMode = 'all';
  saveState();
  render();
  showToast(mode === 'replace'
    ? `Restored ${plural(backup.roles.length, 'role', 'roles')} from the backup.`
    : `Added ${plural(backup.roles.length, 'role', 'roles')} from the backup.`, 'success', { label: 'Undo', onClick: undo });
}

// ── Roles exported from Intune ────────────────────────────────────────────────
function readRoleDefinitions(data) {
  const keyById = new Map(Object.entries(graphIds.ids).map(([key, id]) => [String(id).toLowerCase(), key]));
  return asList(data)
    .filter(def => def && typeof def.displayName === 'string')
    .map(def => {
      const allowed = new Set(), denied = new Set();
      [...(def.rolePermissions || []), ...(def.permissions || [])].forEach(rp => {
        (rp.resourceActions || []).forEach(ra => {
          (ra.allowedResourceActions || []).forEach(id => allowed.add(String(id)));
          (ra.notAllowedResourceActions || []).forEach(id => denied.add(String(id)));
        });
        (rp.actions || []).forEach(id => allowed.add(String(id)));
      });
      const keys = [], unknown = [];
      allowed.forEach(id => {
        if (denied.has(id)) return;
        const key = keyById.get(id.toLowerCase());
        key ? keys.push(key) : unknown.push(id);
      });
      return {
        name: oneLine(def.displayName),
        description: typeof def.description === 'string' ? def.description : '',
        builtIn: !!(def.isBuiltIn || def.isBuiltInRoleDefinition),
        keys, unknown,
      };
    });
}

function importRoleDefinitions(defs) {
  const undo = snapshotState();
  const folder = ensureGroup(IMPORT_FOLDER);
  folder.collapsed = false;
  defs.forEach(def => roles.push(makeRole({
    name: def.name,
    groupId: folder.id,
    description: def.description,
    permissions: new Set(def.keys),
    // A role that already exists in a tenant predates whatever Microsoft has added since
    reviewed: CATALOG_BASELINE,
  })));
  activeRoleId = roles[roles.length - defs.length].id;
  searchQuery = ''; filterMode = 'all';
  saveState();
  render();
  showToast(`Imported ${plural(defs.length, 'role', 'roles')} into "${IMPORT_FOLDER}".`, 'success', { label: 'Undo', onClick: undo });
}

// ── Creating roles in Intune ──────────────────────────────────────────────────
function buildRoleDefinition(role) {
  const allowed = [], missing = [];
  PERM_INDEX.forEach((_perm, key) => {
    if (!role.permissions.has(key)) return;
    graphIds.ids[key] ? allowed.push(graphIds.ids[key]) : missing.push(key);
  });
  return {
    missing,
    unknown: role.unknown || [],
    body: {
      '@odata.type': '#microsoft.graph.deviceAndAppManagementRoleDefinition',
      displayName: oneLine(role.name) || 'Unnamed role',
      description: (role.description || '').trim(),
      isBuiltIn: false,
      rolePermissions: [{ resourceActions: [{ allowedResourceActions: allowed, notAllowedResourceActions: [] }] }],
    },
  };
}

function describeKey(key) {
  const { category, action } = splitKey(key);
  return oneLine(`${category} - ${action}`);
}

function buildIntuneJson(list) {
  const bodies = list.map(r => buildRoleDefinition(r).body);
  return JSON.stringify(bodies.length === 1 ? bodies[0] : bodies, null, 2);
}

function buildPowerShell(list) {
  const lines = [
    `# Creates ${list.length === 1 ? 'a custom Intune role' : `${list.length} custom Intune roles`} designed in Intune RBAC Designer.`,
    `# Generated ${todayStamp()}. Read it through before running it.`,
    '#',
    '# Needs the Microsoft.Graph.Authentication module:',
    '#   Install-Module Microsoft.Graph.Authentication -Scope CurrentUser',
    '# and an account that can use the DeviceManagementRBAC.ReadWrite.All permission.',
    '#',
    '# This creates role definitions only. Assign each role afterwards in the Intune admin center',
    '# under Tenant administration > Roles.',
    '',
    'Connect-MgGraph -Scopes "DeviceManagementRBAC.ReadWrite.All"',
    '',
    '$roles = @(',
  ];
  list.forEach((role, i) => {
    const { body, missing, unknown } = buildRoleDefinition(role);
    // Everything written into a comment is flattened to one line first: a line break inside
    // a name would otherwise end the comment and turn the rest into a command.
    lines.push(`# ${oneLine(body.displayName)}: ${plural(body.rolePermissions[0].resourceActions[0].allowedResourceActions.length, 'permission', 'permissions')}`);
    if (missing.length) {
      lines.push(`# Left out, because your tenant's permission list has no ID for ${missing.length === 1 ? 'it' : 'them'}:`);
      missing.forEach(key => lines.push(`#   ${describeKey(key)}`));
    }
    if (unknown.length) {
      lines.push(`# Left out, because this version of Intune RBAC Designer does not recognise ${unknown.length === 1 ? 'it' : 'them'}:`);
      unknown.forEach(key => lines.push(`#   ${describeKey(key)}`));
    }
    role.assignments.forEach(a => lines.push(`# Planned assignment - ${oneLine(describeAssignment(a))}`));
    lines.push("@'", JSON.stringify(body, null, 2), `'@${i < list.length - 1 ? ',' : ''}`);
  });
  lines.push(
    ')',
    '',
    'foreach ($role in $roles) {',
    `    $created = Invoke-MgGraphRequest -Method POST -Uri "${GRAPH_BASE}/roleDefinitions" -Body $role -ContentType "application/json"`,
    '    Write-Host "Created role:" $created.displayName',
    '}',
    '',
  );
  return lines.join('\n');
}

const HOW_TO_GET_IDS = `
  <details class="howto">
    <summary>How do I get these from my tenant?</summary>
    <p>You need an account that can read Intune role settings (the DeviceManagementRBAC.Read.All permission). Either way, bring the result here by choosing the file or pasting the text.</p>
    <p><strong>In a browser:</strong> open Graph Explorer, sign in, run a GET request for the address below, and copy the response.</p>
    <pre class="code"><code>${GRAPH_BASE}/resourceOperations</code></pre>
    <p><strong>In PowerShell:</strong></p>
    <pre class="code"><code>Connect-MgGraph -Scopes "DeviceManagementRBAC.Read.All"
Invoke-MgGraphRequest -Method GET -Uri "${GRAPH_BASE}/resourceOperations" -OutputType Json | Set-Content resourceOperations.json</code></pre>
    <p>To bring in the roles that already exist in your tenant, do the same with <code>${GRAPH_BASE}/roleDefinitions</code>.</p>
  </details>`;

function graphStatusHtml() {
  const count = graphIdCount();
  if (!count) return `<p class="data-status">${icon(ICON.info, 15)}<span>Not loaded yet. They are only needed to create roles in Intune or to import roles from it.</span></p>`;
  const missing = TOTAL_PERMISSIONS - count;
  return `<p class="data-status ok">${icon(ICON.check, 15, 'stroke-width="2.6"')}<span>IDs known for <strong>${count} of ${TOTAL_PERMISSIONS}</strong> permissions${graphIds.loadedAt ? `, loaded ${escHtml(formatDate(graphIds.loadedAt))}` : ''}.${missing ? ` ${missing} had no match in your tenant's list.` : ''}${graphIds.unknown ? ` Your tenant lists ${graphIds.unknown} that this app doesn't know.` : ''}</span></p>`;
}

// ── "Backup and import" dialog ────────────────────────────────────────────────
function openDataDialog() {
  let open = true;
  const dialog = openDialog({
    eyebrow: 'Your data',
    title: 'Backup and import',
    size: 'lg',
    onClose: () => {
      open = false;
      // The dialog element is shared, so its drop handlers must not outlive this dialog
      const body = document.getElementById('dialog-body');
      body.ondragover = null;
      body.ondrop = null;
    },
    body: `
      <section class="data-section">
        <h3>Save a backup</h3>
        <p>Everything in one file: roles, folders, descriptions, notes and planned assignments. Use it to keep a copy, move to another PC, or hand your design to a colleague.</p>
        <button class="btn btn-secondary" id="data-backup" ${roles.length ? '' : 'disabled'}>${icon(ICON.download, 15)} Save backup file</button>
      </section>

      ${localStorage.getItem(UNREADABLE_KEY) === null ? '' : `
      <section class="data-section" id="data-recover">
        <h3>Saved data that couldn't be read</h3>
        <p>When the app last started, some of what was saved on this PC couldn't be read. It was set aside rather than deleted. Save it as a file to keep it or to send to whoever supports this app, then remove it from here.</p>
        <div class="data-actions">
          <button class="btn btn-secondary" id="data-recover-save">${icon(ICON.download, 15)} Save it as a file</button>
          <button class="btn btn-ghost" id="data-recover-discard">Remove it</button>
        </div>
      </section>`}

      <section class="data-section">
        <h3>Bring in a file</h3>
        <p>A backup from this app, roles exported from Intune, or Intune's permission IDs. The app works out which it is.</p>
        <div class="data-actions">
          <button class="btn btn-secondary" id="data-choose">${icon(ICON.upload, 15)} Choose a file</button>
          <button class="btn btn-ghost" id="data-paste-toggle">Paste text instead</button>
        </div>
        <div class="data-paste" id="data-paste" hidden>
          <textarea id="data-paste-text" rows="5" placeholder="Paste the JSON here" aria-label="JSON to import" spellcheck="false"></textarea>
          <button class="btn btn-secondary btn-sm" id="data-paste-go">Read pasted text</button>
        </div>
        <div id="data-result" role="status"></div>
      </section>

      <section class="data-section">
        <h3>Intune permission IDs</h3>
        <p>Intune refers to each permission by an internal ID. Your tenant can list them, and the app only needs that list once.</p>
        <div id="data-graph-status"></div>
        ${HOW_TO_GET_IDS}
        <div class="data-actions"><button class="btn btn-ghost btn-sm" id="data-forget-ids" hidden>Forget these IDs</button></div>
      </section>`,
  });

  dialog.body.querySelector('#data-recover-save')?.addEventListener('click', () => {
    downloadFile(`Intune-RBAC-Designer-unreadable-${todayStamp()}.txt`, localStorage.getItem(UNREADABLE_KEY) || '', 'text/plain');
    showToast('File saved.', 'success');
  });
  dialog.body.querySelector('#data-recover-discard')?.addEventListener('click', () => {
    const kept = localStorage.getItem(UNREADABLE_KEY);
    localStorage.removeItem(UNREADABLE_KEY);
    dialog.body.querySelector('#data-recover').remove();
    showToast('Removed.', '', { label: 'Undo', onClick: () => { if (kept !== null) keepUnreadable(kept); } });
  });

  const result = dialog.body.querySelector('#data-result');
  const say = (html, kind = '') => { result.innerHTML = `<div class="data-message ${kind}">${html}</div>`; };

  function drawGraphStatus() {
    dialog.body.querySelector('#data-graph-status').innerHTML = graphStatusHtml();
    dialog.body.querySelector('#data-forget-ids').hidden = graphIdCount() === 0;
  }

  function offerBackup(backup) {
    const when = backup.exportedAt ? ` saved ${escHtml(formatDate(backup.exportedAt))}` : '';
    const summary = `<strong>Backup${when}</strong> with ${plural(backup.roles.length, 'role', 'roles')}${backup.groups.length ? ` in ${plural(backup.groups.length, 'folder', 'folders')}` : ''}.${backup.skipped ? ` ${plural(backup.skipped, 'entry', 'entries')} in the file couldn't be read and will be skipped.` : ''}`;
    if (!backup.roles.length) { say(`${summary} There is nothing in it to restore.`, 'warn'); return; }
    say(`${summary}
      <div class="data-actions">
        ${roles.length ? '<button class="btn btn-primary btn-sm" data-restore="merge">Add to my roles</button><button class="btn btn-secondary btn-sm" data-restore="replace">Replace my roles</button>'
                       : '<button class="btn btn-primary btn-sm" data-restore="replace">Restore</button>'}
      </div>`);
    result.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', () => { closeDialog(); restoreBackup(backup, btn.dataset.restore); });
    });
  }

  function takeIds(data, source) {
    const read  = readResourceOperations(data);
    const found = Object.keys(read.ids).length;
    if (!found) { say("That looks like Intune's permission list, but none of its entries matched a permission this app knows.", 'error'); return; }
    graphIds = { ids: { ...graphIds.ids, ...read.ids }, loadedAt: new Date().toISOString(), source, unknown: read.unknown.length };
    saveGraphIds();
    drawGraphStatus();
    say(`<strong>Permission IDs loaded.</strong> Matched ${found} of the ${asList(data).length} entries in the file.
      ${read.incomplete ? ' The file says more pages follow; load those too to get the rest.' : ''}
      You can now use <em>Create in Intune</em> on any role, or bring in a roleDefinitions export.`, 'ok');
  }

  function offerRoleDefinitions(data) {
    if (!graphIdCount()) {
      say("<strong>These are roles exported from Intune.</strong> To read them the app first needs Intune's permission IDs. Load those (see below), then choose this file again.", 'warn');
      return;
    }
    const defs = readRoleDefinitions(data);
    if (!defs.length) { say('No roles were found in that file.', 'error'); return; }
    say(`<strong>${plural(defs.length, 'role', 'roles')} found.</strong> Tick the ones to import.
      <ul class="import-list">
        ${defs.map((d, i) => `<li><label>
          <input type="checkbox" data-index="${i}" ${d.builtIn ? '' : 'checked'}/>
          <span class="import-name">${escHtml(d.name)}${d.builtIn ? '<em>Built-in</em>' : ''}</span>
          <span class="import-meta">${plural(d.keys.length, 'permission', 'permissions')}${d.unknown.length ? `, ${d.unknown.length} not recognised` : ''}</span>
        </label></li>`).join('')}
      </ul>
      <div class="data-actions"><button class="btn btn-primary btn-sm" id="data-import-roles">Import selected</button></div>`);
    result.querySelector('#data-import-roles').addEventListener('click', () => {
      const chosen = [...result.querySelectorAll('.import-list input:checked')].map(cb => defs[Number(cb.dataset.index)]);
      if (!chosen.length) { showToast('Tick at least one role to import.', 'error'); return; }
      closeDialog();
      importRoleDefinitions(chosen);
    });
  }

  function take(text, source) {
    let data;
    try { data = parseJson(text); }
    catch { say("That isn't valid JSON, so it can't be read. If you copied it, make sure you copied all of it.", 'error'); return; }
    try {
      const kind = detectImport(data);
      if (kind === 'backup') offerBackup(readBackup(data));
      else if (kind === 'resourceOperations') takeIds(data, source);
      else if (kind === 'roleDefinitions') offerRoleDefinitions(data);
      else say("The file is valid JSON, but it isn't a backup from this app, a list of Intune roles, or Intune's permission IDs.", 'error');
    } catch (err) {
      // Whatever is wrong with the file, say so rather than leaving the dialog blank
      console.error(err);
      say("That file looks like the right kind, but something in it couldn't be read, so nothing was imported.", 'error');
    }
  }

  dialog.body.querySelector('#data-backup').addEventListener('click', saveBackupFile);
  dialog.body.querySelector('#data-choose').addEventListener('click', async () => {
    const file = await pickFile();
    if (file && open) take(file.text, file.name);
  });
  dialog.body.querySelector('#data-paste-toggle').addEventListener('click', () => {
    const box = dialog.body.querySelector('#data-paste');
    box.hidden = !box.hidden;
    if (!box.hidden) dialog.body.querySelector('#data-paste-text').focus();
  });
  dialog.body.querySelector('#data-paste-go').addEventListener('click', () => {
    const text = dialog.body.querySelector('#data-paste-text').value;
    if (text.trim()) take(text, 'pasted text');
  });
  dialog.body.querySelector('#data-forget-ids').addEventListener('click', () => {
    graphIds = { ids: {}, loadedAt: null, source: '', unknown: 0 };
    saveGraphIds();
    drawGraphStatus();
    say('Permission IDs forgotten.');
  });

  // Dropping a file anywhere on the dialog works too
  dialog.body.ondragover = e => { e.preventDefault(); };
  dialog.body.ondrop = async e => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    if (open) take(text, file.name);
  };

  drawGraphStatus();
}

// ── "Create in Intune" dialog ─────────────────────────────────────────────────
function openIntuneExportDialog(role) {
  if (!graphIdCount()) {
    const dialog = openDialog({
      eyebrow: 'Create in Intune',
      title: role.name || 'Unnamed role',
      size: 'md',
      footer: '<button class="btn btn-secondary" data-close>Not now</button><button class="btn btn-primary" id="intune-load-ids">Load permission IDs</button>',
      body: `
        <p class="dialog-lead">The app can write a PowerShell script, or the JSON for Microsoft Graph, that creates this role in Intune for you.</p>
        <p class="dialog-lead">One thing is needed first. Intune refers to each permission by an internal ID, and those IDs come from your tenant. Load them once and this works for every role from then on.</p>
        ${HOW_TO_GET_IDS}`,
    });
    dialog.footer.querySelector('#intune-load-ids').addEventListener('click', () => openDataDialog());
    return;
  }

  let format = 'powershell';
  let everyRole = false;
  const dialog = openDialog({
    eyebrow: 'Create in Intune',
    title: role.name || 'Unnamed role',
    size: 'lg',
    body: '<div id="intune-root"></div>',
  });
  const root = dialog.body.querySelector('#intune-root');

  function draw() {
    const list    = everyRole ? roles : [role];
    const text    = format === 'powershell' ? buildPowerShell(list) : buildIntuneJson(list);
    const missing = list.flatMap(r => buildRoleDefinition(r).missing.map(key => ({ r, key })));
    const empty   = list.filter(r => r.permissions.size === 0);
    const unknown = list.reduce((n, r) => n + (r.unknown || []).length, 0);

    root.innerHTML = `
      <div class="intune-controls">
        <div class="segmented" role="group" aria-label="Format">
          <button data-format="powershell" class="${format === 'powershell' ? 'active' : ''}">PowerShell</button>
          <button data-format="json" class="${format === 'json' ? 'active' : ''}">Graph JSON</button>
        </div>
        ${roles.length > 1 ? `<label class="switch"><input type="checkbox" id="intune-all" ${everyRole ? 'checked' : ''}/><span class="switch-track"></span><span>All ${roles.length} roles</span></label>` : ''}
        <div class="toolbar-spacer"></div>
        <button class="btn btn-secondary btn-sm" id="intune-copy">${icon(ICON.copy, 14)} Copy</button>
        <button class="btn btn-primary btn-sm" id="intune-download">${icon(ICON.download, 14)} Save file</button>
      </div>
      ${missing.length ? `<div class="data-message warn"><strong>${plural(missing.length, 'permission is', 'permissions are')} left out</strong> because your tenant's list has no ID for ${missing.length === 1 ? 'it' : 'them'}: ${escHtml(missing.slice(0, 6).map(m => describeKey(m.key)).join('; '))}${missing.length > 6 ? ` and ${missing.length - 6} more` : ''}.</div>` : ''}
      ${unknown ? `<div class="data-message warn"><strong>${plural(unknown, 'permission is', 'permissions are')} left out</strong> because this version of the app doesn't recognise ${unknown === 1 ? 'it' : 'them'}. Open the role's checks for the details.</div>` : ''}
      ${empty.length ? `<div class="data-message warn">${everyRole ? `${plural(empty.length, 'role has', 'roles have')} no permissions selected.` : 'This role has no permissions selected.'}</div>` : ''}
      <pre class="code code-tall" id="intune-code"><code>${escHtml(text)}</code></pre>
      <p class="dialog-note">${format === 'powershell'
        ? 'Run it in PowerShell with an account allowed to manage Intune roles. It creates the role definition; assignments are made in the admin center.'
        : `Send it as the body of a POST request to ${GRAPH_BASE}/roleDefinitions${list.length > 1 ? ', one role at a time' : ''}.`}</p>`;

    root.querySelectorAll('[data-format]').forEach(btn => btn.addEventListener('click', () => { format = btn.dataset.format; draw(); }));
    root.querySelector('#intune-all')?.addEventListener('change', e => { everyRole = e.target.checked; draw(); });
    root.querySelector('#intune-copy').addEventListener('click', async () => {
      const ok = await copyText(text);
      showToast(ok ? 'Copied.' : "Couldn't copy. Select the text and copy it yourself.", ok ? 'success' : 'error');
    });
    root.querySelector('#intune-download').addEventListener('click', () => {
      const base = everyRole ? 'Intune-roles' : `Intune-role-${(role.name || 'role').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'role'}`;
      // Windows PowerShell 5.1 needs the byte-order mark to read non-ASCII role names correctly
      if (format === 'powershell') downloadFile(`${base}.ps1`, '﻿' + text, 'text/plain');
      else downloadFile(`${base}.json`, text);
      showToast('File saved.', 'success');
    });
  }

  draw();
}
