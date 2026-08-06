import { describe, expect, it } from 'vitest'
import { dirname, joinPath, normalizePath } from '@/utils/path'

describe('path utilities', () => {
  it('normalizes relative paths', () => {
    expect(normalizePath('banks/../assets/a.png')).toBe('assets/a.png')
    expect(joinPath('banks', '../assets', 'a.png')).toBe('assets/a.png')
    expect(dirname('banks/basic.json')).toBe('banks')
  })
})
