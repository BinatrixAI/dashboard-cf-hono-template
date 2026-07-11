import i18n, { type ParseKeys } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getCookie } from '@/lib/cookies'
import en from './locales/en.json'
import he from './locales/he.json'

/**
 * A valid nested translation key (e.g. 'sidebar.nav.items'), derived from the
 * en.json shape via the module augmentation in i18next.d.ts. Use this to type
 * module-scope data arrays that hold KEYS resolved with t() at render (G2).
 */
export type TranslationKey = ParseKeys

/**
 * The `dir` cookie IS the language detector (LTR = English, RTL = Hebrew), so no
 * i18next-browser-languagedetector. Both locales are bundled (only two), so no
 * http-backend. One `translation` namespace with nested keys, so no per-feature
 * namespace files.
 */
export function langFromDir(dir: string | undefined): 'en' | 'he' {
  return dir === 'rtl' ? 'he' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: langFromDir(getCookie('dir')),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes at render
  react: { useSuspense: false },
})

export default i18n
