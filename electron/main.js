const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let mainWindow;
let tray;

function getFfmpegPath() {
  // 开发环境：从项目根目录下的 bin 读取
  if (isDev) {
    return path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
  }
  // 打包后：从 resources/bin 读取
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
      preload: path.join(__dirname, 'preload.js'),
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
    // 关闭窗口时隐藏到托盘，而不是直接退出应用
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // 创建托盘图标
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'vite.svg')
    : path.join(process.resourcesPath, 'vite.svg');

  tray = new Tray(iconPath);
  tray.setToolTip('本地视频助手');

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
  // 保持托盘常驻，仅在显式退出时真正退出
  if (process.platform !== 'darwin') {
    if (!tray) {
      app.quit();
    }
  }
});

// 简单的转码任务：调用内置 ffmpeg
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

