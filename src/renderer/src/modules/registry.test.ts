import { describe, it, expect } from 'vitest'
import { getActiveUiModules, AVAILABLE_UI_MODULES } from './registry'

describe('Renderer UI Module registry', () => {
  it('returns empty array when no modules are enabled', () => {
    expect(getActiveUiModules([])).toEqual([])
  })

  it('returns pharmacy UI module when pharmacy is in enabled list', () => {
    const active = getActiveUiModules(['pharmacy'])
    expect(active.length).toBe(1)
    expect(active[0]).toBe(AVAILABLE_UI_MODULES.pharmacy)
    expect(active[0].id).toBe('pharmacy')
    expect(active[0].menu.length).toBe(1)
    expect(active[0].menu[0].label).toBe('nav.expiry')
    expect(active[0].menu[0].path).toBe('/pharmacy/expiry')
    expect(active[0].routes.length).toBe(1)
    expect(active[0].routes[0].path).toBe('pharmacy/expiry')
  })

  it('filters out unknown module IDs', () => {
    const active = getActiveUiModules(['unknown', 'pharmacy', 'another_unknown'])
    expect(active.length).toBe(1)
    expect(active[0].id).toBe('pharmacy')
  })
})
