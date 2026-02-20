const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronVideo', {
  transcode: (options) => ipcRenderer.invoke('video:transcode', options),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  onLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('video:log', listener);
    return () => ipcRenderer.removeListener('video:log', listener);
  },
});

