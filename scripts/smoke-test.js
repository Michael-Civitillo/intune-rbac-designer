// Starts the packaged desktop app and does what a first-time user would: create a role,
// tick a permission, export, close, reopen. Run by CI against the Windows build.
//
//   node scripts/smoke-test.js "dist/win-unpacked/Intune RBAC Designer.exe"

const { _electron: electron } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) {
  console.error('usage: node scripts/smoke-test.js <path to the packaged exe>');
  process.exit(2);
}

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function launch() {
  const app = await electron.launch({ executablePath: exe, timeout: 90_000 });
  // Exports are revealed in Explorer once saved; a test run should not pop windows open
  await app.evaluate(({ shell }) => { shell.showItemInFolder = () => {}; }).catch(() => {});
  const page = await app.firstWindow();
  await page.waitForSelector('#btn-new-role', { timeout: 60_000 });
  return { app, page };
}

// Clicks an export button and waits for a new, fully written file matching `pattern` in `dir`
async function nextExport(dir, pattern, trigger) {
  const before = new Set(fs.readdirSync(dir));
  await trigger();
  let lastSize = -1;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 500));
    const fresh = fs.readdirSync(dir).find(f => !before.has(f) && pattern.test(f));
    if (!fresh) continue;
    const size = fs.statSync(path.join(dir, fresh)).size;
    if (size > 0 && size === lastSize) return path.join(dir, fresh);
    lastSize = size;
  }
  return null;
}

(async () => {
  let { app, page } = await launch();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  check('window title', (await page.title()) === 'Intune RBAC Designer', await page.title());
  check('app version matches package.json',
    (await app.evaluate(({ app }) => app.getVersion())) === require('../package.json').version);

  const loaded = await page.evaluate(() => ({
    categories: PERMISSIONS_DATA.length,
    xlsx: typeof XLSX !== 'undefined' && typeof XLSX.writeFile === 'function',
    html2canvas: typeof html2canvas === 'function',
  }));
  check('permission catalogue loaded', loaded.categories === 53, `${loaded.categories} categories`);
  check('bundled export libraries loaded', loaded.xlsx && loaded.html2canvas, JSON.stringify(loaded));

  // Every script the page asks for has to be inside the packaged app
  const features = await page.evaluate(() => ({
    builtInRoles: typeof BUILT_IN_ROLES === 'undefined' ? 0 : BUILT_IN_ROLES.length,
    missing: ['runChecks', 'renderAssignmentsTab', 'openCompareDialog', 'openFindDialog', 'openDataDialog', 'openIntuneExportDialog']
      .filter(name => typeof window[name] !== 'function'),
  }));
  check('all feature scripts are in the build', features.builtInRoles === 9 && features.missing.length === 0, JSON.stringify(features));

  // Start from a clean slate so the test is repeatable on a developer machine too
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#btn-empty-new-role');

  await page.click('#btn-empty-new-role');
  await page.fill('#role-name-input', 'Smoke Test Role');
  await page.click('.category-block[data-cat="Audit data"] .category-name');
  await page.click('.category-block[data-cat="Audit data"] .perm-row[data-action="Read"] .perm-action');
  const stats = (await page.textContent('#perm-stats')).replace(/\s+/g, ' ').trim();
  check('create a role and tick a permission', stats.startsWith('1 of 255 permissions selected'), stats);

  check('served from its own origin', (await page.evaluate(() => location.origin)) === 'app://designer',
    await page.evaluate(() => location.href));

  // Saved roles must be there on every single reload, not just most of them
  let missing = 0;
  for (let i = 0; i < 30; i++) {
    await page.reload();
    await page.waitForSelector('#btn-new-role');
    if ((await page.locator('.role-item').count()) !== 1) missing++;
  }
  check('roles survive 30 reloads in a row', missing === 0, `${missing} reloads came up empty`);

  const online = await page.evaluate(() =>
    fetch('https://example.com/', { mode: 'no-cors' }).then(() => 'reached', () => 'blocked'));
  check('app makes no network requests', online === 'blocked', online);

  const downloads = await app.evaluate(({ app }) => app.getPath('downloads'));
  fs.mkdirSync(downloads, { recursive: true });

  await page.click('#btn-data');
  const backup = await nextExport(downloads, /^Intune-RBAC-Designer-backup-.*\.json$/, () => page.click('#data-backup'));
  let backedUp = [];
  try { backedUp = JSON.parse(fs.readFileSync(backup, 'utf8')).roles.map(r => r.name); } catch { /* reported below */ }
  check('backup file lands in Downloads', backedUp.length === 1 && backedUp[0] === 'Smoke Test Role', String(backup));
  await page.keyboard.press('Escape');

  const xlsx = await nextExport(downloads, /^Intune-RBAC-Roles-.*\.xlsx$/, () => page.click('#btn-export-excel'));
  check('Excel export lands in Downloads',
    !!xlsx && fs.readFileSync(xlsx).subarray(0, 2).toString() === 'PK', String(xlsx));

  const png = await nextExport(downloads, /^Intune-RBAC-Comparison-.*\.png$/, () => page.click('#btn-export-image'));
  check('comparison image lands in Downloads',
    !!png && fs.readFileSync(png).subarray(1, 4).toString() === 'PNG', String(png));

  await page.screenshot({ path: path.join(path.dirname(exe), '..', 'smoke-test.png') }).catch(() => {});
  check('no script errors', pageErrors.length === 0, pageErrors.join(' | '));
  await app.close();

  // Roles are saved on this PC and must still be there next time
  ({ app, page } = await launch());
  const names = await page.$$eval('.role-item .role-name', els => els.map(e => e.textContent));
  check('roles are still there after a restart', names.length === 1 && names[0] === 'Smoke Test Role', JSON.stringify(names));
  await page.evaluate(() => { localStorage.clear(); });
  await app.close();

  for (const file of [backup, xlsx, png]) if (file && fs.existsSync(file)) fs.unlinkSync(file);

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
