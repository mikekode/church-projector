const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ATEM Switcher
    connectAtem: (ip) => ipcRenderer.invoke('atem-connect', ip),
    performAtemAction: (action, input) => ipcRenderer.invoke('atem-action', { action, input }),
    onAtemStatus: (callback) => {
        const handler = (_event, status) => callback(status);
        ipcRenderer.on('atem-status', handler);
        return () => ipcRenderer.removeListener('atem-status', handler);
    },

    // NDI Output
    startNdi: () => ipcRenderer.invoke('ndi-start'),

    // Generic System info
    platform: process.platform,
    version: process.versions.electron,

    // Offline Bible
    getVerse: (query) => ipcRenderer.invoke('get-verse', query),
    getVerseOnline: (query) => ipcRenderer.invoke('lookup-verse-online', query),

    // Window Management
    openProjectorWindow: () => ipcRenderer.invoke('open-projector-window'),
    openStageWindow: () => ipcRenderer.invoke('open-stage-window'),

    // Song Data
    searchSongs: (query) => ipcRenderer.invoke('song-search', query),
    getLyrics: (title, artist) => ipcRenderer.invoke('song-lyrics', { title, artist }),

    // AI
    smartDetect: (payload) => ipcRenderer.invoke('smart-detect', payload),

    // Auto Update
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateAvailable: (cb) => {
        const handler = (_, info) => cb(info);
        ipcRenderer.on('update-available', handler);
        return () => ipcRenderer.removeListener('update-available', handler);
    },
    onUpdateDownloaded: (cb) => {
        const handler = (_, info) => cb(info);
        ipcRenderer.on('update-downloaded', handler);
        return () => ipcRenderer.removeListener('update-downloaded', handler);
    },
    onUpdateError: (cb) => {
        const handler = (_, err) => cb(err);
        ipcRenderer.on('update-error', handler);
        return () => ipcRenderer.removeListener('update-error', handler);
    }
});
