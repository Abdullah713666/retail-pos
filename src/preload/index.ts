import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/ipc-contract'
import type { CreateUserInput, LoginInput, SetupCompleteInput } from '../shared/types'

const api: IpcApi = {
  ping: () => ipcRenderer.invoke('ping'),
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  db: {
    getMigrationStatus: () => ipcRenderer.invoke('db:getMigrationStatus')
  },
  setup: {
    complete: (input: SetupCompleteInput) => ipcRenderer.invoke('setup:complete', input)
  },
  modules: {
    getEnabled: () => ipcRenderer.invoke('modules:getEnabled'),
    setEnabled: (moduleIds: string[]) => ipcRenderer.invoke('modules:setEnabled', moduleIds)
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (input: { key: string; value: string }) => ipcRenderer.invoke('settings:set', input),
    setMany: (settings: Record<string, string>) => ipcRenderer.invoke('settings:setMany', settings)
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (input: CreateUserInput) => ipcRenderer.invoke('users:create', input),
    deactivate: (id: number) => ipcRenderer.invoke('users:deactivate', id)
  },
  auth: {
    login: (input: LoginInput) => ipcRenderer.invoke('auth:login', input),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    hasUsers: () => ipcRenderer.invoke('auth:hasUsers')
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
