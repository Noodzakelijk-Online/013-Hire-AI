import { describe, expect, it } from "vitest";
import { extractTextFromRTF } from "./resumeParser";

describe("RTF resume extraction", () => {
  it("converts common RTF text controls into readable resume text", () => {
    const text = extractTextFromRTF(Buffer.from(
      "{\\rtf1\\ansi Jane Doe\\par Skills: TypeScript\\tab React\\par Caf\\'e9}",
      "utf8"
    ));

    expect(text).toBe("Jane Doe\nSkills: TypeScript\tReact\nCafé");
  });

  it("rejects input that is not an RTF document", () => {
    expect(() => extractTextFromRTF(Buffer.from("Plain text", "utf8")))
      .toThrow("Failed to extract text from RTF");
  });

  it("drops malformed Unicode controls instead of throwing", () => {
    expect(extractTextFromRTF(Buffer.from("{\\rtf1\\ansi Hello \\u9999999? world}", "utf8")))
      .toBe("Hello  world");
  });
});
