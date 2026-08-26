import { describe, it, expect, beforeEach, vi } from "vitest";
import { i18n } from "./i18n";
import { storage } from "./storage";

describe("i18n storage interaction", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it("should retrieve uiLocale using storage.getUiLocale during init", async () => {
    const getSpy = vi.spyOn(storage, "getUiLocale").mockImplementation(async () => "es");
    await i18n.reinit();
    expect(getSpy).toHaveBeenCalled();
  });

  it("should set uiLocale using storage.setUiLocale during setLocale", async () => {
    const setSpy = vi.spyOn(storage, "setUiLocale").mockImplementation(async () => {});
    await i18n.setLocale("en");
    expect(setSpy).toHaveBeenCalledWith("en");
  });
});
