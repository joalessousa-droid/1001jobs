import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pt from "./locales/pt.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import { privacyPolicy } from "@/data/privacyPolicy";
import privacyPolicyEn from "@/data/privacyPolicy.en.json";
import privacyPolicyEs from "@/data/privacyPolicy.es.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: { ...pt, privacy: { ...pt.privacy, document: privacyPolicy, toc: "Sumário" } } },
      en: { translation: { ...en, privacy: { ...en.privacy, document: privacyPolicyEn, toc: "Contents" } } },
      es: { translation: { ...es, privacy: { ...es.privacy, document: privacyPolicyEs, toc: "Índice" } } },
    },
    fallbackLng: "pt",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
