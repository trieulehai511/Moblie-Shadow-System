import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import vi from './locales/vi.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const supportedLanguages = ['vi', 'en', 'ja', 'ko'] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

const deviceLanguage = getLocales()[0]?.languageCode;

const initialLanguage: SupportedLanguage =
  supportedLanguages.includes(deviceLanguage as SupportedLanguage)
    ? (deviceLanguage as SupportedLanguage)
    : 'vi';

void i18n
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: 'en',

    resources: {
      vi: {
        translation: vi,
      },
      en: {
        translation: en,
      },
      ja: {
        translation: ja,
      },
      ko: {
        translation: ko,
      },
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
