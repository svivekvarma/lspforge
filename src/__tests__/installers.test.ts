import { describe, it, expect } from "vitest";
import { selectInstaller } from "../installers/index.js";
import type { PackageSource } from "../core/registry.js";
import type { AvailableRuntimes } from "../core/platform.js";

describe("selectInstaller", () => {
  const allRuntimes: AvailableRuntimes = {
    npm: true,
    python: true,
    pip: true,
    cargo: true,
    go: true,
  };

  const noRuntimes: AvailableRuntimes = {
    npm: false,
    python: false,
    pip: false,
    cargo: false,
    go: false,
  };

  it("selects npm when available", () => {
    const source: PackageSource = {
      npm: { package: "test", bin: "test" },
    };
    const result = selectInstaller(source, allRuntimes);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("npm");
  });

  it("falls back to pip when npm unavailable", () => {
    const source: PackageSource = {
      npm: { package: "test", bin: "test" },
      pip: { package: "test", bin: "test" },
    };
    const runtimes = { ...noRuntimes, pip: true };
    const result = selectInstaller(source, runtimes);
    expect(result!.type).toBe("pip");
  });

  it("selects cargo installer", () => {
    const source: PackageSource = {
      cargo: { package: "test", bin: "test" },
    };
    const runtimes = { ...noRuntimes, cargo: true };
    const result = selectInstaller(source, runtimes);
    expect(result!.type).toBe("cargo");
  });

  it("selects go installer", () => {
    const source: PackageSource = {
      go: { package: "test", bin: "test" },
    };
    const runtimes = { ...noRuntimes, go: true };
    const result = selectInstaller(source, runtimes);
    expect(result!.type).toBe("go");
  });

  it("falls back to binary download", () => {
    const source: PackageSource = {
      github_release: {
        repo: "test/test",
        tag: "v1.0",
        assets: {},
        bin: "test",
        extract: "none",
      },
    };
    const result = selectInstaller(source, noRuntimes);
    expect(result!.type).toBe("binary");
  });

  it("returns null when no installer matches", () => {
    const source: PackageSource = {
      npm: { package: "test", bin: "test" },
    };
    const result = selectInstaller(source, noRuntimes);
    expect(result).toBeNull();
  });

  it("prioritizes npm over pip", () => {
    const source: PackageSource = {
      npm: { package: "test", bin: "test" },
      pip: { package: "test", bin: "test" },
    };
    const result = selectInstaller(source, allRuntimes);
    expect(result!.type).toBe("npm");
  });
});
