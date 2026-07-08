// Browser globals are NOT enabled in the node-env `client` vitest project, so
// import every test helper explicitly (see vitest.config.ts `client` project).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cmsBaseUrl, cmsAdminUrl, cmsFetch } from './cms-client'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('cmsBaseUrl', () => {
  it('returns null when VITE_CMS_API_URL is unset', () => {
    vi.stubEnv('VITE_CMS_API_URL', '')
    expect(cmsBaseUrl()).toBeNull()
  })

  it('returns null for whitespace-only value', () => {
    vi.stubEnv('VITE_CMS_API_URL', '   ')
    expect(cmsBaseUrl()).toBeNull()
  })

  it('returns the value unchanged when it has no trailing slash', () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com')
    expect(cmsBaseUrl()).toBe('https://cms.example.com')
  })

  it('strips a single trailing slash', () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com/')
    expect(cmsBaseUrl()).toBe('https://cms.example.com')
  })
})

describe('cmsAdminUrl', () => {
  it('returns null when VITE_CMS_API_URL is unset (D-10)', () => {
    vi.stubEnv('VITE_CMS_API_URL', '')
    expect(cmsAdminUrl()).toBeNull()
  })

  it('derives ${origin}/admin (D-09)', () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com')
    expect(cmsAdminUrl()).toBe('https://cms.example.com/admin')
  })

  it('uses the ORIGIN only, dropping any path (D-09)', () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com/base/')
    expect(cmsAdminUrl()).toBe('https://cms.example.com/admin')
  })

  it('returns null when the base is an invalid URL', () => {
    vi.stubEnv('VITE_CMS_API_URL', 'not a url')
    expect(cmsAdminUrl()).toBeNull()
  })
})

describe('cmsFetch', () => {
  it('throws "CMS not configured" when VITE_CMS_API_URL is unset', async () => {
    vi.stubEnv('VITE_CMS_API_URL', '')
    await expect(cmsFetch('/api/blog-posts')).rejects.toThrow(
      'CMS not configured'
    )
  })

  it('fetches the absolute cross-origin URL with EXACTLY ONE argument (no credentials — D-07)', async () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com')
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) })
    vi.stubGlobal('fetch', fetchMock)

    await cmsFetch('/api/blog-posts')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // No second init/options object => browser sends no cookies/Authorization.
    expect(fetchMock.mock.calls[0]).toHaveLength(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://cms.example.com/api/blog-posts'
    )
  })

  it('resolves to the parsed JSON on res.ok', async () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com')
    const body = { posts: [{ id: '1' }] }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => body })
    )
    await expect(cmsFetch('/api/blog-posts')).resolves.toEqual(body)
  })

  it('throws with the status when !res.ok', async () => {
    vi.stubEnv('VITE_CMS_API_URL', 'https://cms.example.com')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    )
    await expect(cmsFetch('/api/blog-posts')).rejects.toThrow('503')
  })
})
