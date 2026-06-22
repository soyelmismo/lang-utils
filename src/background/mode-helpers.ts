// ============================================
// Lang Utils - Mode helpers
// Pure functions for finding modes, computing
// effective prompts/models, and language detection.
// ============================================

import { AnyMode, Mode, ModeGroup, SubMode } from "../types";
import { LANG_MAP } from "./modes";

/** Result of searching for a mode by id (single or inside a group). */
export interface ModeLookup {
  mode: AnyMode;
  subMode: SubMode | null;
}

/** Find a mode or sub-mode by id across the entire list. */
export function findModeById(
  modes: AnyMode[],
  id: string
): ModeLookup | null {
  for (const m of modes) {
    if (m.id === id) return { mode: m, subMode: null };
    if (m.type === "group" && m.subModes) {
      for (const sub of m.subModes) {
        if (sub.id === id) return { mode: m, subMode: sub };
      }
    }
  }
  return null;
}

/** Replace {{selection}} placeholders in a prompt with the selected text. */
export function getEffectivePrompt(
  modeOrSub: { prompt?: string },
  selectionText: string
): string {
  return (modeOrSub.prompt || "").replace(/\{\{selection\}\}/g, selectionText);
}

/** Get the effective model for a sub-mode, inheriting from parent group / global. */
export function getEffectiveModel(
  subMode: { model?: string } | null,
  parentMode: { model?: string } | null
): string {
  if (subMode && subMode.model && subMode.model.trim()) return subMode.model;
  if (parentMode && parentMode.model && parentMode.model.trim()) {
    return parentMode.model;
  }
  return "";
}

/** Is this mode a translation mode? (Heuristic based on name + prompt.) */
export function isTranslationMode(
  mode: { prompt?: string; name?: string } | null
): boolean {
  if (!mode) return false;
  const text = ((mode.prompt || "") + " " + (mode.name || "")).toLowerCase();
  return text.includes("traduc") || text.includes("translat");
}

/** Try to detect the target language of a translation mode from its name. */
export function getTargetLangFromMode(mode: {
  name?: string;
}): string | null {
  const name = (mode.name || "").toLowerCase();
  for (const code in LANG_MAP) {
    if (name.includes(LANG_MAP[code]!)) return code;
  }
  if (name.includes("english")) return "en";
  if (name.includes("french") || name.includes("francais")) return "fr";
  if (name.includes("german") || name.includes("deutsch")) return "de";
  if (name.includes("italian") || name.includes("italiano")) return "it";
  if (name.includes("portuguese") || name.includes("portugues")) return "pt";
  if (name.includes("chinese") || name.includes("chino")) return "zh";
  if (name.includes("japanese") || name.includes("japones")) return "ja";
  if (name.includes("korean") || name.includes("coreano")) return "ko";
  return null;
}

/** Type guard: is this mode a group? */
export function isModeGroup(m: AnyMode): m is ModeGroup {
  return m.type === "group";
}

/** Type guard: is this mode a single mode? */
export function isModeSingle(m: AnyMode): m is Mode {
  return m.type === "single";
}

/** Get all sub-modes flattened (used for translate-mode iteration). */
export function getAllSubModes(modes: AnyMode[]): Array<{
  group: ModeGroup;
  sub: SubMode;
}> {
  const out: Array<{ group: ModeGroup; sub: SubMode }> = [];
  for (const m of modes) {
    if (isModeGroup(m) && m.subModes) {
      for (const sub of m.subModes) {
        out.push({ group: m, sub });
      }
    }
  }
  return out;
}
