// ============================================
// Lang Utils - Default modes data
// Shipped with the extension; user can edit, add,
// delete, and restore to these defaults.
// ============================================

import { AnyMode } from "../types";

/** Map of language codes → lowercase english name (used by translation-mode detection). */
export const LANG_MAP: Record<string, string> = {
  es: "espanol",
  en: "english",
  pt: "portugues",
  fr: "francais",
  de: "deutsch",
  it: "italiano",
  zh: "chino",
  ja: "japones",
  ko: "coreano",
  ar: "arabe",
  hi: "hindi",
  ru: "ruso",
  nl: "holandes",
  pl: "polaco",
  tr: "turco",
};

/** Default modes shipped with the extension. */
export const DEFAULT_MODES: AnyMode[] = [
  {
    id: "redact",
    name: "Redactar",
    type: "group",
    favorite: true,
    model: "",
    subModes: [
      {
        id: "redact-informal",
        name: "Informal",
        prompt:
          "Reescribe el siguiente texto en un estilo informal y cercano, como si se lo contaras a un amigo:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-formal",
        name: "Formal",
        prompt:
          "Reescribe el siguiente texto en un estilo formal, profesional y respetuoso, adecuado para documentos oficiales o comunicacion empresarial:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-street",
        name: "Street / Calle",
        prompt:
          "Reescribe el siguiente texto con un estilo callejero, urbano y desenfadado, usando jerga moderna y expresiones coloquiales:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-academic",
        name: "Academico",
        prompt:
          "Reescribe el siguiente texto en estilo academico formal, con vocabulario preciso, estructura clara y tono objetivo:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-creative",
        name: "Creativo / Literario",
        prompt:
          "Reescribe el siguiente texto con un estilo creativo y literario, usando metaforas, lenguaje figurado y un tono expresivo:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-concise",
        name: "Conciso / Directo",
        prompt:
          "Reescribe el siguiente texto de forma extremadamente concisa y directa, eliminando todo lo redundante sin perder el significado esencial:\n\n{{selection}}",
        model: "",
      },
      {
        id: "redact-persuasive",
        name: "Persuasivo",
        prompt:
          "Reescribe el siguiente texto con un tono persuasivo y convincente, usando argumentos fuertes y lenguaje impactante:\n\n{{selection}}",
        model: "",
      },
    ],
  },
  {
    id: "translate-es",
    name: "Traducir al espanol",
    prompt:
      "Traduce el siguiente texto al espanol. Responde SOLO con la traduccion:\n\n{{selection}}",
    isDefault: true,
    favorite: true,
    model: "",
    type: "single",
  },
  {
    id: "translate-en",
    name: "Translate to English",
    prompt:
      "Translate the following text to English. Reply ONLY with the translation:\n\n{{selection}}",
    isDefault: true,
    favorite: true,
    model: "",
    type: "single",
  },
  {
    id: "summarize",
    name: "Resumir texto",
    prompt: "Resume el siguiente texto de forma clara y concisa:\n\n{{selection}}",
    isDefault: true,
    favorite: false,
    model: "",
    type: "single",
  },
  {
    id: "explain-simple",
    name: "Explicar en terminos simples",
    prompt:
      "Explica este texto de forma simple, como a alguien sin conocimiento previo:\n\n{{selection}}",
    isDefault: true,
    favorite: false,
    model: "",
    type: "single",
  },
  {
    id: "explain-style",
    name: "Explicar a mi manera",
    prompt:
      "Reescribe este texto en estilo casual y directo, como si lo explicaras a un amigo:\n\n{{selection}}",
    isDefault: true,
    favorite: false,
    model: "",
    type: "single",
  },
  {
    id: "ask-ai",
    name: "Preguntar sobre el texto...",
    prompt: "__CHATBOT__",
    isDefault: true,
    favorite: false,
    model: "",
    type: "single",
  },
];

/** Deep clone of DEFAULT_MODES (used for reset). */
export function cloneDefaultModes(): AnyMode[] {
  return JSON.parse(JSON.stringify(DEFAULT_MODES)) as AnyMode[];
}
