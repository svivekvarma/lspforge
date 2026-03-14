import { describe, it, expect } from "vitest";
import { getDataDir, getServersDir, getServerDir, getStatePath } from "../core/paths.js";
import { platform } from "node:os";

describe("paths", () => {
  it("getDataDir returns a path string", () => {
    const dir = getDataDir();
    expect(typeof dir).toBe("string");
    expect(dir).toContain("lspforge");
  });

  it("getServersDir is under data dir", () => {
    expect(getServersDir()).toContain(getDataDir());
    expect(getServersDir()).toContain("servers");
  });

  it("getServerDir includes server name", () => {
    expect(getServerDir("pyright")).toContain("pyright");
  });

  it("getStatePath points to state.json", () => {
    expect(getStatePath()).toMatch(/state\.json$/);
  });

  it("uses LOCALAPPDATA on Windows", () => {
    if (platform() === "win32") {
      expect(getDataDir()).toContain("lspforge");
    }
  });
});
