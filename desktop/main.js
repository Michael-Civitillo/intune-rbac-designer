// Desktop shell for Intune RBAC Designer.
//
// The app itself is the same static page that runs in a browser (index.html and friends).
// This file only gives it a window, keeps it offline, and sends exports to the Downloads folder.

const { app, BrowserWindow, Menu, nativeTheme, protocol, screen, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_ID       = 'io.github.michael-civitillo.intune-rbac-designer';
const PROJECT_URL  = 'https://github.com/Michael-Civitillo/intune-rbac-designer';
const APP_ROOT     = path.join(__dirname, '..');
// The page is served from its own origin rather than file://, so saved roles always live
// in one stable, well-defined place.
const APP_ORIGIN   = 'app://designer';
// Everything the app needs ships inside it; nothing is fetched over the network.
const LOCAL_SCHEME = /^(app|data|blob|devtools|chrome):/i;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

// Must happen before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true } },
]);

let mainWindow = null;

// app://designer/<path> -> the matching file inside the app, and nothing outside it
function serveAppFiles() {
  protocol.handle('app', async request => {
    const url = new URL(request.url);
    if (url.host !== 'designer') return new Response(null, { status: 404 });

    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(APP_ROOT, relative);
    const inside = path.relative(APP_ROOT, file);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return new Response(null, { status: 403 });

    try {
      const body = await fs.promises.readFile(file);
      const type = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(body, { headers: { 'content-type': type, 'cache-control': 'no-cache' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width:  Math.min(1440, width),
    height: Math.min(920, height),
    minWidth: 420,
    minHeight: 480,
    show: false, // shown once the page has painted, so there is no white flash
    title: 'Intune RBAC Designer',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c1016' : '#f4f5f7',
    autoHideMenuBar: true, // press Alt to reveal the menu
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  // Make sure the latest changes are on disk before the window goes away
  mainWindow.on('close', () => session.defaultSession.flushStorageData());
  mainWindow.on('closed', () => { mainWindow = null; });

  const contents = mainWindow.webContents;

  // The window only ever shows the app. Web links open in the default browser instead.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
  });

  // The menu's Zoom In shortcut is Ctrl+Plus, which needs Shift on most keyboards.
  // Accept plain Ctrl+= as well, the way browsers do.
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key === '=') {
      contents.setZoomLevel(contents.getZoomLevel() + 0.5);
      event.preventDefault();
    }
  });

  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
}

function lockDownSession() {
  const ses = session.defaultSession;

  // No network access: refuse anything that is not a local resource.
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !LOCAL_SCHEME.test(details.url) });
  });

  // The app needs no camera, location, notifications or similar.
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  // Exports go straight to Downloads, like they would from a browser, and the file is then
  // highlighted in Explorer so it is obvious where it went.
  ses.on('will-download', (_event, item) => {
    let target;
    try {
      const dir = app.getPath('downloads');
      fs.accessSync(dir, fs.constants.W_OK);
      target = uniquePath(dir, path.basename(item.getFilename()));
    } catch {
      return; // no usable Downloads folder: fall back to the standard Save As dialog
    }
    item.setSavePath(target);
    item.once('done', (_e, state) => {
      if (state === 'completed') shell.showItemInFolder(target);
    });
  });
}

// "Report.xlsx" -> "Report (1).xlsx" and so on, so an earlier export is never overwritten
function uniquePath(dir, filename) {
  const { name, ext } = path.parse(filename);
  let candidate = path.join(dir, filename);
  for (let i = 1; fs.existsSync(candidate); i++) candidate = path.join(dir, `${name} (${i})${ext}`);
  return candidate;
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: '&File', submenu: [{ role: 'quit', label: 'E&xit' }] },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Project page on GitHub', click: () => shell.openExternal(PROJECT_URL) },
        { type: 'separator' },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]);
}

// One window is enough: launching the app again brings the existing window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    serveAppFiles();
    lockDownSession();
    Menu.setApplicationMenu(buildMenu());
    createWindow();
  });

  app.on('before-quit', () => session.defaultSession.flushStorageData());
  app.on('window-all-closed', () => app.quit());
}
