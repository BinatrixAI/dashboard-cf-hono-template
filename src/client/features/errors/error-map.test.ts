import { describe, expect, it } from 'vitest'
import { ERROR_MAP, resolveErrorComponent } from './error-map'
import { ForbiddenError } from './forbidden'
import { GeneralError } from './general-error'
import { MaintenanceError } from './maintenance-error'
import { NotFoundError } from './not-found-error'
import { UnauthorisedError } from './unauthorized-error'

describe('resolveErrorComponent (SEC-07)', () => {
  it.each([
    ['unauthorized', UnauthorisedError],
    ['forbidden', ForbiddenError],
    ['not-found', NotFoundError],
    ['internal-server-error', GeneralError],
    ['maintenance-error', MaintenanceError],
  ])('%s resolves to its own component', (slug, component) => {
    expect(resolveErrorComponent(slug)).toBe(component)
  })

  it.each([
    'constructor',
    'toString',
    '__proto__',
    'valueOf',
    'hasOwnProperty',
    '',
    'Forbidden',
    'not-found ',
    '%D7%90',
    'אבג',
  ])('%j falls back to NotFoundError', (slug) => {
    expect(resolveErrorComponent(slug)).toBe(NotFoundError)
  })

  it('maps exactly the five known slugs', () => {
    expect(ERROR_MAP.size).toBe(5)
  })
})
