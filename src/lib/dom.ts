// ============================================
// Lang Utils - DOM helpers
// Provides typed element-getters to avoid
// `as HTMLxxxElement` casts scattered around.
// ============================================

export function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function $btn(id: string): HTMLButtonElement | null {
  return document.getElementById(id) as HTMLButtonElement | null;
}

export function $input(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

export function $textarea(id: string): HTMLTextAreaElement | null {
  return document.getElementById(id) as HTMLTextAreaElement | null;
}

export function $select(id: string): HTMLSelectElement | null {
  return document.getElementById(id) as HTMLSelectElement | null;
}

export function $div(id: string): HTMLDivElement | null {
  return document.getElementById(id) as HTMLDivElement | null;
}

export function $span(id: string): HTMLSpanElement | null {
  return document.getElementById(id) as HTMLSpanElement | null;
}

export function $heading(id: string): HTMLHeadingElement | null {
  return document.getElementById(id) as HTMLHeadingElement | null;
}

export function $form(id: string): HTMLFormElement | null {
  return document.getElementById(id) as HTMLFormElement | null;
}

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
