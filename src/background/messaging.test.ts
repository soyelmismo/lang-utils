import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock browser before importing messaging
vi.mock("../lib/browser-compat", () => {
  return {
    default: {
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn(),
      },
    },
  };
});

import browser from "../lib/browser-compat";
import { broadcastUpdated } from "./messaging";

describe("broadcastUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends messages concurrently to all tabs with numeric IDs", async () => {
    const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }];
    vi.mocked(browser.tabs.query).mockResolvedValue(tabs as unknown as browser.Tabs.Tab[]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);

    await broadcastUpdated("modes-updated");

    expect(browser.tabs.query).toHaveBeenCalledWith({});
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(3);
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(1, 1, { type: "modes-updated" });
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(2, 2, { type: "modes-updated" });
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(3, 3, { type: "modes-updated" });
  });

  it("handles errors per tab gracefully without stopping other tab messages", async () => {
    const tabs = [{ id: 10 }, { id: 20 }, { id: 30 }];
    vi.mocked(browser.tabs.query).mockResolvedValue(tabs as unknown as browser.Tabs.Tab[]);
    vi.mocked(browser.tabs.sendMessage).mockImplementation(async (tabId) => {
      if (tabId === 20) {
        throw new Error("No content script in tab");
      }
    });

    await expect(broadcastUpdated("settings-updated")).resolves.not.toThrow();

    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(3);
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(10, { type: "settings-updated" });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(20, { type: "settings-updated" });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(30, { type: "settings-updated" });
  });

  it("ignores tabs without valid numeric ID", async () => {
    const tabs = [{ id: undefined }, { id: 100 }];
    vi.mocked(browser.tabs.query).mockResolvedValue(tabs as unknown as browser.Tabs.Tab[]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);

    await broadcastUpdated("modes-updated");

    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(100, { type: "modes-updated" });
  });
});
