// Browser globals are NOT enabled in the node-env `client` vitest project, so
// import every test helper explicitly (see vitest.config.ts `client` project).
import { describe, it, expect } from 'vitest'
import { lexicalToPlainText } from './lexical-text'

describe('lexicalToPlainText', () => {
  it('joins paragraph text with newlines', () => {
    const tree = {
      root: {
        children: [
          { children: [{ text: 'Hello' }] },
          { children: [{ text: 'World' }] },
        ],
      },
    }
    expect(lexicalToPlainText(tree)).toBe('Hello\nWorld')
  })

  it('concatenates nested inline nodes within a block', () => {
    const tree = {
      root: {
        children: [
          { children: [{ text: 'Foo' }, { text: 'Bar' }, { text: 'Baz' }] },
        ],
      },
    }
    expect(lexicalToPlainText(tree)).toBe('FooBarBaz')
  })

  it('returns the fallback for undefined', () => {
    expect(lexicalToPlainText(undefined)).toBe('No preview available')
  })

  it('returns the fallback for null', () => {
    expect(lexicalToPlainText(null)).toBe('No preview available')
  })

  it('returns the fallback for a non-object', () => {
    expect(lexicalToPlainText('just a string')).toBe('No preview available')
  })

  it('returns the fallback when root.children is missing', () => {
    expect(lexicalToPlainText({ root: {} })).toBe('No preview available')
  })

  it('never throws on a malformed tree', () => {
    const tree = {
      root: { children: [{ nope: true }, null, { children: null }] },
    }
    expect(() => lexicalToPlainText(tree)).not.toThrow()
    expect(typeof lexicalToPlainText(tree)).toBe('string')
  })
})
