const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ATEM Switcher
    connectAtem: (ip) => ipcRenderer.invoke('atem-connect', ip),
    performAtemAction: (action, input) => ipcRenderer.invoke('atem-action', { action, input }),

    // NDI Output
    startNdi: () => ipcRenderer.invoke('ndi-start'),

    // Generic System info
    platform: process.platform,
    version: process.versions.electron,

    // Offline Bible
    getVerse: (query) => ipcRenderer.invoke('get-verse', query),

    // Window Management
    openProjectorWindow: () => ipcRenderer.invoke('open-projector-window'),

    // Song Data
    searchSongs: (query) => ipcRenderer.invoke('song-search', query),
    getLyrics: (title, artist) => ipcRenderer.invoke('song-lyrics', { title, artist }),

    // AI
    smartDetect: (payload) => ipcRenderer.invoke('smart-detect', payload)
});
