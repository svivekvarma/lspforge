import { describe, it, expect } from "vitest";
import { detectPlatform } from "../core/platform.js";

describe("detectPlatform", () => {
  it("returns valid platform info", () => {
    const info = detectPlatform();
    expect(["win32", "darwin", "linux"]).toContain(info.os);
    expect(["x64", "arm64"]).toContain(info.arch);
    expect(info.key).toMatch(/^(win|darwin|linux)_(x64|arm64)$/);
    expect(info.isWindows).toBe(info.os === "win32");
  });
});
