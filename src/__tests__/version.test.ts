import { describe, it, expect } from "vitest";
import { compareVersions, isNewer } from "../utils/version.js";

describe("compareVersions", () => {
  it("returns 0 for identical versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 0 for identical single-segment versions", () => {
    expect(compareVersions("5", "5")).toBe(0);
  });

  it("detects newer major version", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
  });

  it("detects newer minor version", () => {
    expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
    expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
  });

  it("detects newer patch version", () => {
    expect(compareVersions("1.1.408", "1.1.410")).toBe(-1);
    expect(compareVersions("1.1.410", "1.1.408")).toBe(1);
  });

  it("handles different segment lengths", () => {
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
  });

  it("strips leading v prefix", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("v1.2.3", "v1.2.4")).toBe(-1);
  });

  it("handles date-like tag strings", () => {
    expect(compareVersions("2025-03-10", "2025-03-15")).toBe(-1);
    expect(compareVersions("2025-03-15", "2025-03-10")).toBe(1);
    expect(compareVersions("2025-03-10", "2025-03-10")).toBe(0);
  });

  it("handles non-numeric segments via string comparison", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(1);
  });

  it("handles zero-padded numeric segments", () => {
    expect(compareVersions("2025-03-10", "2025-3-10")).toBe(0);
    expect(compareVersions("01", "1")).toBe(0);
    expect(compareVersions("03", "2")).toBe(1);
  });
});

describe("isNewer", () => {
  it("returns true when registry version is newer", () => {
    expect(isNewer("1.1.408", "1.1.410")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewer("1.1.408", "1.1.408")).toBe(false);
  });

  it("returns false when installed version is newer", () => {
    expect(isNewer("1.1.410", "1.1.408")).toBe(false);
  });

  it("works with date tags", () => {
    expect(isNewer("2025-03-10", "2025-03-15")).toBe(true);
    expect(isNewer("2025-03-15", "2025-03-10")).toBe(false);
  });
});
