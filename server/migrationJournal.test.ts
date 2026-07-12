import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type MigrationJournal = {
  entries: Array<{
    idx: number;
    tag: string;
  }>;
};

describe("Drizzle migration journal", () => {
  it("registers every committed SQL migration in order", () => {
    const migrationsDirectory = resolve(process.cwd(), "drizzle");
    const journalPath = resolve(migrationsDirectory, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;
    const migrationTags = readdirSync(migrationsDirectory)
      .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
      .sort()
      .map((fileName) => fileName.replace(/\.sql$/, ""));

    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index)
    );
    expect(journal.entries.map((entry) => entry.tag)).toEqual(migrationTags);
  });
});
