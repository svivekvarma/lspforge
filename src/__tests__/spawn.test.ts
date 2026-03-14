import { describe, it, expect } from "vitest";
import { exec, commandExists } from "../utils/spawn.js";

describe("exec", () => {
  it("runs a command and captures stdout", async () => {
    const result = await exec("node", ["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^v\d+/);
  });

  it("returns non-zero for failing commands", async () => {
    const result = await exec("node", ["-e", "process.exit(1)"]);
    expect(result.code).toBe(1);
  });

  it("handles non-existent commands gracefully", async () => {
    const result = await exec("definitely-not-a-real-command-xyz");
    expect(result.code).not.toBe(0);
  });
});

describe("commandExists", () => {
  it("finds node", async () => {
    expect(await commandExists("node")).toBe(true);
  });

  it("returns false for nonexistent command", async () => {
    expect(await commandExists("definitely-not-a-real-command-xyz")).toBe(
      false,
    );
  });
});
