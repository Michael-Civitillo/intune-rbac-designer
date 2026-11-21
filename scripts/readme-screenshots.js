// Retakes every screenshot in the README from sample data, so they can be refreshed after
// a change to the UI instead of going stale.
//
//   node scripts/readme-screenshots.js            writes to docs/screenshots/
//   node scripts/readme-screenshots.js <folder>   writes somewhere else, to look before replacing
//
// Needs Playwright with a Chromium browser (npx playwright install chromium). The sample
// roles below are made up; nothing is read from or written to your own saved roles.

const path = require('path');
const fs = require('fs');
const os = require('os');

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }

const appDir = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(appDir, 'docs', 'screenshots'));
const SCALE = Number(process.env.SCREENSHOT_SCALE) || 2;
const VIEW = { width: 1360, height: 900 };
const SIDEBAR_WIDTH = 318;   // wide enough to show every sample role name in full

// Runs in the page, where the permission list is available
function sampleData(PERMISSIONS_DATA, CATALOG_DATE) {
  const all  = c => PERMISSIONS_DATA.find(x => x.category === c).permissions.map(p => `${c}||${p.action}`);
  const pick = (c, ...actions) => actions.map(a => `${c}||${a}`);
  // The permissions that only let someone look, leaving out the ones that reveal passwords and keys
  const read = (...cats) => cats.flatMap(c => all(c).filter(k => /\|\|(read|view)\b/i.test(k) && !/password|key/i.test(k)));
  const assignment = (id, name, adminGroups, scopeGroups, scopeTags, description = '') =>
    ({ id, name, description, adminGroups, scopeGroups, scopeTags });

  const groups = [
    { id: 'g1', name: 'Service desk' },
    { id: 'g2', name: 'Windows' },
    { id: 'g3', name: 'Apple' },
    { id: 'g4', name: 'Security' },
  ];

  const roles = [
    {
      id: 'tier1', name: 'Tier 1 Helpdesk', groupId: 'g1', reviewed: CATALOG_DATE,
      description: 'First-line service desk. Can see devices, sync and restart them, and view a screen with the user watching.',
      permissions: [
        ...pick('Remote Help app', 'View screen'),
        ...pick('Remote tasks', 'Sync devices.', 'Reboot now', 'Remote lock', 'Offer remote assistance'),
        ...read('Managed devices', 'Remote assistance connectors', 'Organization'),
      ],
      assignments: [assignment('a1', 'All service desk staff', ['SG-Intune-Helpdesk-T1'], ['All devices'], ['Default'])],
    },
    {
      id: 'tier3', name: 'Tier 3 Helpdesk', groupId: 'g1',
      description: 'Senior service desk staff who handle escalations, including device resets and unattended remote help.',
      permissions: [
        ...pick('Remote Help app', 'Elevation', 'Take full control', 'Android unattended control', 'View screen'),
        ...pick('Remote tasks', 'Sync devices.', 'Reboot now', 'Remote lock', 'Offer remote assistance', 'Reset passcode', 'Collect diagnostics', 'Retire', 'Rotate Local Admin Password'),
        ...pick('Managed devices', 'Read', 'View reports', 'Set primary user'),
        ...read('Remote assistance connectors', 'Organization', 'Device configurations', 'Device compliance policies'),
      ],
      notes: {
        'Remote Help app||Take full control': 'Only with the user present. Sessions are recorded in the audit log.',
        'Remote Help app||Android unattended control': 'Warehouse scanners only; see the Warehouse kiosks assignment.',
        'Remote tasks||Retire': 'Needed for the leavers process (HR ticket type LVR).',
      },
      assignments: [
        assignment('a2', 'EMEA service desk', ['SG-Intune-Helpdesk-T3-EMEA'], ['All devices', 'SG-Users-EMEA'], ['EMEA'], 'Covers the UK and DE offices'),
        assignment('a3', 'Warehouse kiosks', ['SG-Intune-Kiosk-Support'], [], ['Kiosk']),
      ],
    },
    {
      id: 'winadmin', name: 'Windows Endpoint Admin', groupId: 'g2', reviewed: CATALOG_DATE,
      description: 'Owns Windows configuration and compliance policy, and Autopilot enrollment.',
      permissions: [
        ...all('Device configurations'), ...all('Device compliance policies'), ...all('Filters'),
        ...pick('Managed devices', 'Read', 'Update', 'View reports', 'Set primary user'),
        ...pick('Remote tasks', 'Sync devices.', 'Reboot now', 'Collect diagnostics', 'Rotate Local Admin Password', 'Wipe'),
        ...pick('Enrollment programs', 'Read profile', 'Read device', 'Sync device', 'Assign profile'),
        ...read('Organization', 'Audit data'),
      ],
      notes: { 'Remote tasks||Wipe': 'For re-provisioning through Autopilot. Requests go through change control.' },
      assignments: [assignment('a4', 'Windows platform team', ['SG-Intune-Windows-Admins'], ['All devices'], ['Windows'])],
    },
    {
      id: 'packager', name: 'Windows App Packager', groupId: 'g2', reviewed: CATALOG_DATE,
      description: 'Packages and deploys Win32 and Store apps.',
      permissions: [...all('Mobile apps'), ...read('Managed devices', 'Organization')],
      assignments: [assignment('a5', 'App packaging team', ['SG-Intune-App-Packagers'], ['All devices', 'All users'], ['Windows'])],
    },
    {
      id: 'macos', name: 'macOS Platform Engineer', groupId: 'g3', reviewed: CATALOG_DATE,
      description: 'Runs the Mac fleet: configuration, Apple Business Manager enrollment and FileVault recovery.',
      permissions: [
        ...all('Device configurations'),
        ...pick('Enrollment programs', 'Read profile', 'Read token', 'Read device', 'View macOS admin password', 'Rotate macOS admin password'),
        ...pick('Remote tasks', 'Get FileVault key.', 'Rotate FileVault key.', 'Remote lock', 'Sync devices.'),
        ...read('Managed devices', 'Organization'),
      ],
      assignments: [assignment('a6', 'Mac engineering', ['SG-Intune-Mac-Engineers'], ['SG-Devices-macOS'], ['Apple'])],
    },
    {
      id: 'ios', name: 'iOS & iPadOS Operator', groupId: 'g3', reviewed: CATALOG_DATE,
      description: 'Looks after company iPhones and iPads: lost mode, locating and locking devices.',
      permissions: [
        ...pick('Remote tasks', 'Enable lost mode', 'Disable lost mode', 'Locate device', 'Remote lock', 'Sync devices.'),
        ...read('Managed devices', 'Mobile apps', 'Organization'),
      ],
      assignments: [assignment('a7', 'Mobile support', ['SG-Intune-Mobile-Support'], ['SG-Devices-iOS'], ['Apple'])],
    },
    {
      id: 'security', name: 'Endpoint Security Analyst', groupId: 'g4', reviewed: CATALOG_DATE,
      description: 'Manages security baselines and attack surface reduction, and reads detection and response data.',
      permissions: [
        ...all('Security baselines'), ...all('Attack Surface Reduction'),
        ...read('Endpoint Detection and Response', 'Security tasks', 'Managed devices', 'Organization'),
      ],
      assignments: [assignment('a8', 'Security operations', ['SG-SecOps-Analysts'], ['All devices'], ['Default'])],
    },
    {
      id: 'auditor', name: 'Read-only Auditor', groupId: null, reviewed: CATALOG_DATE,
      description: 'Internal audit. Can see everything and change nothing.',
      permissions: read(...PERMISSIONS_DATA.map(c => c.category).filter(c => c !== 'Telecom expenses')),
      assignments: [assignment('a9', 'Internal audit', ['SG-Internal-Audit'], ['All devices', 'All users'], ['Default'])],
    },
  ];

  return { app: 'intune-rbac-designer', version: 3, groups, roles };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  const errors = [];

  async function openApp(colorScheme = 'light') {
    const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme });
    await ctx.route(/^https?:\/\//, route => route.abort());      // the app is offline; keep it that way
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + path.join(appDir, 'index.html'));
    await page.evaluate(([fn, width]) => {
      const data = (new Function(`return (${fn})`))()(PERMISSIONS_DATA, CATALOG_DATE);
      localStorage.clear();
      localStorage.setItem('intuneRbacRoles', JSON.stringify(data));
      localStorage.setItem('intuneRbacSidebarWidth', String(width));
    }, [sampleData.toString(), SIDEBAR_WIDTH]);
    await page.reload();
    return { ctx, page };
  }

  const settle = page => page.waitForTimeout(450);
  const file = name => path.join(outDir, `${name}.png`);

  async function shootPage(page, name) {
    await settle(page);
    await page.screenshot({ path: file(name) });
    console.log(`  ${name}.png`);
  }

  // A dialog, with a little of the dimmed page around it
  async function shootDialog(page, name, selector = '#dialog-box') {
    await settle(page);
    const box = await page.locator(selector).boundingBox();
    const margin = 28;
    const x = Math.max(0, box.x - margin), y = Math.max(0, box.y - margin);
    await page.screenshot({
      path: file(name),
      clip: { x, y, width: Math.min(VIEW.width - x, box.width + margin * 2), height: Math.min(VIEW.height - y, box.height + margin * 2) },
    });
    console.log(`  ${name}.png`);
  }

  const openRole = (page, id) => page.locator(`.role-item[data-id="${id}"]`).click();
  // Puts a category at the top of the permission list, opened
  const showCategory = (page, category) => page.evaluate(name => {
    const block = [...document.querySelectorAll('.category-block')].find(b => b.dataset.cat === name);
    if (block.classList.contains('collapsed')) block.querySelector('.category-header').click();
    block.scrollIntoView({ block: 'start' });
  }, category);
  const scrollToTop = page => page.evaluate(() => { document.getElementById('permissions-pane').scrollTop = 0; });

  console.log(`Writing screenshots to ${outDir}`);
  let { ctx, page } = await openApp('light');

  // ── The editor ──
  await openRole(page, 'tier3');
  await showCategory(page, 'Remote Help app');
  await shootPage(page, 'overview-light');

  await openRole(page, 'macos');
  await page.locator('#perm-search').fill('password');
  await scrollToTop(page);
  await shootPage(page, 'search');
  await page.locator('#perm-search').fill('');
  await openRole(page, 'tier3');

  await page.locator('#new-pill').click();
  await shootPage(page, 'whats-new');
  await page.locator('.segmented button[data-filter="all"]').click();

  await page.locator('.tab[data-tab="assignments"]').click();
  await shootPage(page, 'assignments');
  await page.locator('.tab[data-tab="permissions"]').click();

  // ── Dialogs ──
  await page.locator('#checks-pill').click();
  await shootDialog(page, 'checks');
  await page.keyboard.press('Escape');

  await page.locator('#btn-summary').click();
  await shootDialog(page, 'summary');
  await page.keyboard.press('Escape');

  await page.locator('#btn-new-role-menu').click();
  await page.locator('.menu-item', { hasText: 'From a built-in role' }).click();
  await page.evaluate(() => document.activeElement.blur());
  await page.locator('#dialog-body').getByText('Help Desk Operator', { exact: true }).hover();
  await shootDialog(page, 'built-in-roles');
  await page.keyboard.press('Escape');

  await page.locator('#btn-compare').click();
  await page.evaluate(() => document.querySelectorAll('.chip-toggle').forEach(chip => {
    if (chip.classList.contains('on') !== ['tier1', 'tier3', 'ios'].includes(chip.dataset.id)) chip.click();
  }));
  await shootDialog(page, 'compare');
  await page.keyboard.press('Escape');

  await page.locator('#btn-find').click();
  await page.locator('#find-input').fill('lock');
  await shootDialog(page, 'who-has');
  await page.keyboard.press('Escape');

  // Bring a backup file back in, to show what the app says about it
  const backupFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rbac-shots-')), 'Intune-RBAC-Designer-backup.json');
  fs.writeFileSync(backupFile, await page.evaluate(() => JSON.stringify(buildBackup())));
  await page.locator('#btn-data').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#data-choose').click()]);
  await chooser.setFiles(backupFile);
  await page.locator('[data-restore]').first().waitFor();
  await shootDialog(page, 'backup-import');
  await page.keyboard.press('Escape');
  fs.rmSync(path.dirname(backupFile), { recursive: true, force: true });

  // Intune's permission IDs come from a tenant. These stand-ins only have the same shape.
  await page.evaluate(() => {
    const value = [];
    PERMISSIONS_DATA.forEach(c => c.permissions.forEach(p => value.push({
      id: `Microsoft.Intune_${c.category.replace(/[^A-Za-z]/g, '')}_${p.action.replace(/[^A-Za-z]/g, '').slice(0, 30)}`,
      resourceName: c.category, actionName: p.action, description: p.description,
    })));
    graphIds = { ids: readResourceOperations({ value }).ids, loadedAt: new Date().toISOString(), source: 'resourceOperations.json', unknown: 0 };
  });
  await page.locator('#btn-intune').click();
  await shootDialog(page, 'create-in-intune');
  await page.keyboard.press('Escape');

  // ── High-impact confirmation ──
  await openRole(page, 'tier1');
  await showCategory(page, 'Remote tasks');
  await page.locator('.perm-row[data-cat="Remote tasks"][data-action="Wipe"] .perm-action').click();
  await shootDialog(page, 'destructive-warning', '#destructive-modal .modal');
  await page.locator('#destructive-cancel').click();
  await ctx.close();

  // ── Dark mode ──
  ({ ctx, page } = await openApp('dark'));
  await openRole(page, 'winadmin');
  await showCategory(page, 'Device compliance policies');
  await shootPage(page, 'dark-mode');
  await ctx.close();

  await browser.close();
  if (errors.length) { console.error('Script errors in the page:\n' + errors.join('\n')); process.exit(1); }
  console.log('Done');
})().catch(err => { console.error(err); process.exit(1); });
