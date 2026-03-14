import { describe, it, expect } from "vitest";
import { toFileUri } from "../utils/file-uri.js";
import { platform } from "node:os";

describe("toFileUri", () => {
  if (platform() === "win32") {
    it("converts Windows path to proper file URI", () => {
      const uri = toFileUri("C:\\Users\\test\\project");
      expect(uri).toBe("file:///C:/Users/test/project");
    });

    it("handles forward slashes on Windows", () => {
      const uri = toFileUri("C:/Users/test/project");
      expect(uri).toBe("file:///C:/Users/test/project");
    });
  } else {
    it("converts Unix path to file URI", () => {
      const uri = toFileUri("/home/user/project");
      expect(uri).toBe("file:///home/user/project");
    });
  }
});
