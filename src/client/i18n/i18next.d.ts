import 'i18next'
import type en from './locales/en.json'

// Makes t('...') key-safe across the whole app from the English locale shape.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en }
  }
}
