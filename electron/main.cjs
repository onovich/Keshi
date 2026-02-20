const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let mainWindow;
let tray;

function getFfmpegPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
  }
  return path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'vite.svg')
    : path.join(process.resourcesPath, 'vite.svg');

  tray = new Tray(iconPath);
  tray.setToolTip('Keshi Studio · 芥子');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        createWindow();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!tray) {
      app.quit();
    }
  }
});

// 桌面版：用系统“打开文件”对话框获取完整路径，避免 input file 无 path
ipcMain.handle('dialog:openFile', async () => {
  const win = mainWindow || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || {}, {
    properties: ['openFile'],
    filters: [{ name: '视频', extensions: ['mkv', 'mp4', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv'] }],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('video:transcode', async (event, payload) => {
  const { inputPath, format, lossless, crf } = payload;

  return new Promise((resolve) => {
    const outputPath = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}_converted.${format.toLowerCase()}`
    );

    const args = ['-i', inputPath];
    if (lossless) {
      args.push('-c', 'copy');
    } else {
      args.push('-vcodec', 'libx264', '-crf', String(crf || 23), '-preset', 'ultrafast');
    }
    args.push(outputPath);

    const logs = [];

    const ffmpegPath = getFfmpegPath();
    const ff = spawn(ffmpegPath, args);

    ff.stderr.on('data', (data) => {
      const text = data.toString();
      logs.push(text);
      event.sender.send('video:log', text);
    });

    ff.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, outputPath, logs: logs.join('') });
      } else {
        resolve({
          success: false,
          error: `ffmpeg 退出代码: ${code}`,
          logs: logs.join(''),
        });
      }
    });

    ff.on('error', (err) => {
      resolve({ success: false, error: err.message, logs: logs.join('') });
    });
  });
});

