import type { UiModule } from './types'
import { pharmacyUiModule } from './pharmacy'

export const AVAILABLE_UI_MODULES: Record<string, UiModule> = {
  pharmacy: pharmacyUiModule
}

/**
 * Returns UI modules matching the given list of enabled module IDs.
 */
export function getActiveUiModules(enabledIds: string[]): UiModule[] {
  return enabledIds
    .map((id) => AVAILABLE_UI_MODULES[id])
    .filter((mod): mod is UiModule => Boolean(mod))
}
