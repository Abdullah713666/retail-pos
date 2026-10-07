import type { MainModule, ModuleContext } from '../types'
import pharmacyMigration001 from './migrations/001_pharmacy.sql?raw'

export const pharmacyMainModule: MainModule = {
  id: 'pharmacy',
  migrations: [
    {
      id: 'pharmacy/001_init',
      sql: pharmacyMigration001
    }
  ],
  registerIpc(_ctx: ModuleContext): void {
    // Pharmacy IPC handlers will be registered here in M12
  }
}
