// ── Sanity checks ─────────────────────────────────────────────────────────────
// Looks over a role for likely mistakes. Nothing here blocks anything: each finding is a
// prompt to double-check, with a one-click fix where the fix is unambiguous.
//
//   runChecks(role, allRoles) -> [{ id, level: 'warn' | 'info', title, detail, fix? }]
//   fix: { label, add?: [permKey], remove?: [permKey] }

const REPORT_ACTION = /^view reports$/i;
const VIEW_ACTION   = /^(read|view)\b/i;

// "You can't usefully change what you can't open": for each category, which permission lets
// an admin see the thing, and which permissions act on it. Most categories have one "Read";
// the entries below cover the ones that don't follow that shape. An empty list means the
// category has no such relationship.
const READ_PAIR_OVERRIDES = {
  'Remote Help app':  [],
  'Remote tasks':     [],
  'ServiceNow':       [],
  'Telecom expenses': [],
  // "Set primary user" is covered by Microsoft's own, stricter requirement below
  'Managed devices': [{ read: 'Read', writes: ['Delete', 'Query', 'Read Bios Password', 'Update'] }],
  'Multi Admin Approval': [{ read: 'Read access policy', writes: ['Create access policy', 'Delete access policy', 'Update access policy'] }],
  'Cloud attached devices': [
    { read: 'View scripts',      writes: ['Run script'] },
    { read: 'View applications', writes: ['Take application actions'] },
  ],
};

const READ_PAIRS = (() => {
  const pairs = new Map();
  PERMISSIONS_DATA.forEach(cat => {
    const actions = cat.permissions.map(p => p.action);
    if (READ_PAIR_OVERRIDES[cat.category]) {
      pairs.set(cat.category, READ_PAIR_OVERRIDES[cat.category]);
    } else if (cat.category === 'Enrollment programs') {
      // Devices, profiles and tokens each have their own Read
      pairs.set(cat.category, ['device', 'profile', 'token'].map(thing => ({
        read: `Read ${thing}`,
        writes: actions.filter(a => a.endsWith(` ${thing}`) && a !== `Read ${thing}`),
      })));
    } else {
      const views  = actions.filter(a => VIEW_ACTION.test(a) && !REPORT_ACTION.test(a));
      const writes = actions.filter(a => !views.includes(a) && !REPORT_ACTION.test(a));
      pairs.set(cat.category, views.length === 1 && writes.length ? [{ read: views[0], writes }] : []);
    }
  });
  return pairs;
})();

function listActions(actions) {
  return actions.length <= 3 ? actions.join(', ') : `${actions.slice(0, 3).join(', ')} and ${actions.length - 3} more`;
}

function runChecks(role, allRoles = []) {
  const findings = [];
  const has = (category, action) => role.permissions.has(permKey(category, action));
  const selectedIn = category => (PERMISSIONS_DATA.find(c => c.category === category)?.permissions || [])
    .map(p => p.action).filter(a => has(category, a));

  // ── Name ──
  const name = (role.name || '').trim();
  if (!name) {
    findings.push({ id: 'name-missing', level: 'warn', title: 'This role has no name',
      detail: 'Intune needs a name to create the role, and exports are easier to read with one.' });
  } else if (allRoles.some(r => r !== role && (r.name || '').trim().toLowerCase() === name.toLowerCase())) {
    findings.push({ id: 'name-duplicate', level: 'warn', title: 'Another role has the same name',
      detail: `Two roles called "${name}" are easy to mix up in Intune and in exports.` });
  }

  // ── Acting on something without being able to open it ──
  READ_PAIRS.forEach((pairs, category) => {
    pairs.forEach(({ read, writes }) => {
      const granted = writes.filter(a => has(category, a));
      if (!granted.length || has(category, read)) return;
      findings.push({
        id: `read:${category}:${read}`,
        level: 'warn',
        title: `${category}: ${listActions(granted)} without ${read}`,
        detail: category === 'Remote assistance connectors'
          ? 'Microsoft notes that Update also requires Remote assistance connectors – Read, to view the status of the TeamViewer connector and remote help.'
          : `Admins usually need ${read} to open what they are changing, so ${granted.length === 1 ? 'this permission does' : 'these permissions do'} little without it.`,
        fix: { label: `Add ${read}`, add: [permKey(category, read)] },
      });
    });
  });

  // ── Requirements Microsoft states outright ──
  if (has('Managed devices', 'Set primary user')) {
    const missing = ['Read', 'Update'].filter(a => !has('Managed devices', a));
    if (missing.length) {
      findings.push({
        id: 'needs:set-primary-user', level: 'warn',
        title: `Managed devices: Set primary user needs ${missing.join(' and ')}`,
        detail: 'Microsoft says Set primary user must be used in combination with the Managed devices Read and Update permissions.',
        fix: { label: `Add ${missing.join(' and ')}`, add: missing.map(a => permKey('Managed devices', a)) },
      });
    }
  }

  const remoteTasks = selectedIn('Remote tasks');
  if (remoteTasks.length) {
    const missing = [['Managed devices', 'Read'], ['Organization', 'Read']].filter(([c, a]) => !has(c, a));
    if (missing.length) {
      findings.push({
        id: 'needs:remote-task-visibility', level: 'warn',
        title: `Remote tasks without ${missing.map(([c, a]) => `${c} – ${a}`).join(' or ')}`,
        detail: "A remote action can only be run on a device the admin can see. Microsoft's guidance for a custom role is the Remote tasks permission plus permissions that give visibility of managed devices, for example Organization – Read and Managed devices – Read.",
        fix: { label: `Add ${missing.map(([c, a]) => `${c} – ${a}`).join(' and ')}`, add: missing.map(([c, a]) => permKey(c, a)) },
      });
    }
  }

  const roleChanges = ['Assign', 'Create', 'Delete', 'Update'].filter(a => has('Roles', a));
  if (roleChanges.length && !has('Organization', 'Read')) {
    findings.push({
      id: 'needs:roles-organization-read', level: 'warn',
      title: 'Roles permissions without Organization – Read',
      detail: 'Microsoft lists Organization – Read alongside the Roles permissions as what a custom role needs to manage roles and assignments.',
      fix: { label: 'Add Organization – Read', add: [permKey('Organization', 'Read')] },
    });
  }

  // ── Things worth a second look ──
  const escalation = ['Assign', 'Create', 'Update'].filter(a => has('Roles', a));
  if (escalation.length) {
    findings.push({
      id: 'risk:role-management', level: 'warn',
      title: `Can change who holds Intune roles (Roles – ${escalation.join(', ')})`,
      detail: "Anyone with this role can create roles or change role assignments, which includes giving themselves more access. Microsoft's built-in Intune Role Administrator exists for this job; keep these permissions out of everyday roles.",
    });
  }

  const telecom = selectedIn('Telecom expenses');
  if (telecom.length) {
    findings.push({
      id: 'deprecated:telecom-expenses', level: 'warn',
      title: 'Telecom expenses is no longer supported',
      detail: 'Microsoft deprecated the telecom expense partner connector; these permissions have had no effect since June 2025.',
      fix: { label: 'Remove them', remove: telecom.map(a => permKey('Telecom expenses', a)) },
    });
  }

  const highImpact = highImpactKeys(role);
  if (highImpact.length >= 3) {
    findings.push({
      id: 'risk:high-impact', level: 'info',
      title: `Holds ${highImpact.length} high-impact permissions`,
      detail: `${highImpact.map(k => { const { category, action } = splitKey(k); return `${category} – ${action}`; }).join('; ')}. Consider whether they all belong in one role, and keep its assignment narrowly scoped.`,
    });
  }

  // ── Assignments ──
  (role.assignments || []).forEach(a => {
    const label = a.name.trim() || 'Unnamed assignment';
    const noAdmins = a.adminGroups.length === 0, noScope = a.scopeGroups.length === 0;
    if (noAdmins && noScope) {
      findings.push({ id: `assignment:${a.id}:empty`, level: 'warn', title: `Assignment "${label}" is empty`,
        detail: 'It has no admin groups and no scope groups yet.' });
    } else if (noAdmins) {
      findings.push({ id: `assignment:${a.id}:admins`, level: 'warn', title: `Assignment "${label}" has no admin groups`,
        detail: 'Without an admin group, nobody receives this role through the assignment.' });
    } else if (noScope) {
      findings.push({ id: `assignment:${a.id}:scope`, level: 'warn', title: `Assignment "${label}" has no scope groups`,
        detail: 'Scope (Groups) decides which users and devices its admins can manage. With none, they can manage nobody.' });
    }
  });

  return findings;
}

function applyCheckFix(role, finding) {
  const { add = [], remove = [] } = finding.fix;
  const added   = add.filter(k => !role.permissions.has(k));
  const removed = remove.filter(k => role.permissions.has(k));
  added.forEach(k => role.permissions.add(k));
  removed.forEach(k => role.permissions.delete(k));
  saveState();
  return () => {
    added.forEach(k => role.permissions.delete(k));
    removed.forEach(k => role.permissions.add(k));
    saveState();
  };
}

function checksListHtml(findings) {
  if (!findings.length) {
    return `<div class="checks-clear">${icon(ICON.check, 22, 'stroke-width="2.4"')}<span>Nothing to flag. This role passes every check.</span></div>`;
  }
  return `<ul class="checks-list">${findings.map((f, i) => `
    <li class="check check-${f.level}">
      <span class="check-icon">${icon(f.level === 'warn' ? ICON.alert : ICON.info, 16, 'stroke-width="2.2"')}</span>
      <div class="check-text">
        <strong>${escHtml(f.title)}</strong>
        <span>${escHtml(f.detail)}</span>
      </div>
      ${f.fix ? `<button class="btn btn-secondary btn-sm check-fix" data-index="${i}">${escHtml(f.fix.label)}</button>` : ''}
    </li>`).join('')}</ul>`;
}

function openChecksDialog(role) {
  let open = true;
  const dialog = openDialog({
    eyebrow: 'Checks',
    title: role.name || 'Unnamed role',
    size: 'md',
    onClose: () => { open = false; },
  });

  function draw() {
    const findings = runChecks(role, roles);
    dialog.body.innerHTML = `
      <p class="dialog-lead">These are prompts to double-check, not rules. Nothing here stops you exporting the role.</p>
      ${checksListHtml(findings)}`;
    dialog.body.querySelectorAll('.check-fix').forEach(btn => {
      btn.addEventListener('click', () => {
        const finding = findings[Number(btn.dataset.index)];
        const undo = applyCheckFix(role, finding);
        if (getActiveRole() === role) renderMainPanel();
        renderSidebar();
        draw();
        showToast(`${finding.fix.label}: done.`, 'success', {
          label: 'Undo',
          onClick: () => {
            undo();
            render();
            if (open) draw();
          }
        });
      });
    });
  }

  draw();
}
