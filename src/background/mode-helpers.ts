// ============================================
// Lang Utils - Mode helpers
// Pure functions for finding modes and computing
// effective prompts/models for sub-modes.
// ============================================

import { AnyMode, Mode, ModeGroup, SubMode } from "../types";

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
