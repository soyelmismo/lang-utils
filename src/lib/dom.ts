// ============================================
// Lang Utils - DOM helpers
// Provides typed element-getters to avoid
// `as HTMLxxxElement` casts scattered around.
// ============================================

export function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export const $btn = (id: string): HTMLButtonElement | null => $<HTMLButtonElement>(id);

export const $input = (id: string): HTMLInputElement | null => $<HTMLInputElement>(id);

export const $textarea = (id: string): HTMLTextAreaElement | null => $<HTMLTextAreaElement>(id);

export const $select = (id: string): HTMLSelectElement | null => $<HTMLSelectElement>(id);

export const $div = (id: string): HTMLDivElement | null => $<HTMLDivElement>(id);

export const $span = (id: string): HTMLSpanElement | null => $<HTMLSpanElement>(id);

export const $heading = (id: string): HTMLHeadingElement | null => $<HTMLHeadingElement>(id);

export const $form = (id: string): HTMLFormElement | null => $<HTMLFormElement>(id);

/** Get the value of a form-like element by id, or empty string. */
export function getValue(id: string): string {
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  return el?.value || "";
}

/** Set the value of a form-like element by id. */
export function setValue(id: string, value: string): void {
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (el) el.value = value;
}
