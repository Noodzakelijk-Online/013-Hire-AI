import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("connector credential storage policy", () => {
  it("keeps social profile records credential-free and retires the legacy token column", () => {
    const root = process.cwd();
    const schema = readFileSync(resolve(root, "drizzle", "schema.ts"), "utf8");
    const migration = readFileSync(
      resolve(root, "drizzle", "0021_retire_social_access_tokens.sql"),
      "utf8"
    );

    expect(schema).not.toContain('accessToken: text("access_token")');
    expect(migration).toMatch(/ALTER TABLE\s+`social_media_profiles`\s+DROP COLUMN\s+`access_token`/i);
  });
});
