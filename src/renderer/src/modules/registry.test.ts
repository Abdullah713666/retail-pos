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
    expect(active[0].menu.map((m) => m.path)).toEqual(['/pharmacy/expiry', '/pharmacy/want-book'])
    expect(active[0].routes.map((r) => r.path)).toEqual(['pharmacy/expiry', 'pharmacy/want-book'])
    expect(active[0].dashboardWidgets?.length).toBe(1)
    expect(active[0].itemFormFields).toBeDefined()
    expect(active[0].saleLineInfo).toBeDefined()
  })

  it('filters out unknown module IDs', () => {
    const active = getActiveUiModules(['unknown', 'pharmacy', 'another_unknown'])
    expect(active.length).toBe(1)
    expect(active[0].id).toBe('pharmacy')
  })
})
