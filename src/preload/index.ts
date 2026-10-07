import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/ipc-contract'

const api: IpcApi = {
  ping: () => ipcRenderer.invoke('ping'),
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  db: {
    getMigrationStatus: () => ipcRenderer.invoke('db:getMigrationStatus')
  },
  modules: {
    getEnabled: () => ipcRenderer.invoke('modules:getEnabled'),
    setEnabled: (moduleIds: string[]) => ipcRenderer.invoke('modules:setEnabled', moduleIds)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback if not context isolated (should never happen per ARCHITECTURE §3)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).api = api
}
