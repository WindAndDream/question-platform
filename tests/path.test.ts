import { describe, expect, it } from 'vitest'
import { dirname, joinPath, normalizePath, resolvePublicPath } from '@/utils/path'

describe('path utilities', () => {
  it('normalizes relative paths', () => {
    expect(normalizePath('banks/../assets/a.png')).toBe('assets/a.png')
    expect(joinPath('banks', '../assets', 'a.png')).toBe('assets/a.png')
    expect(dirname('banks/basic.json')).toBe('banks')
  })

  it('resolves public assets from the deployment base path', () => {
    expect(resolvePublicPath('/question-banks/manifest.json', '/question-platform/')).toBe(
      '/question-platform/question-banks/manifest.json',
    )
    expect(resolvePublicPath('question-banks/manifest.json', '/')).toBe('/question-banks/manifest.json')
  })
})
