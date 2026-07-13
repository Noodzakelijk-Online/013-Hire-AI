import { describe, expect, it } from "vitest";
import { RESUME_MIME_TYPES, validateUploadedFile } from "./uploadValidation";

describe("sensitive upload validation", () => {
  it("accepts a bounded PDF with a matching signature", () => {
    expect(validateUploadedFile({
      data: Buffer.from("%PDF-1.7 test"),
      fileName: "candidate.pdf",
      mimeType: "application/pdf",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toMatchObject({ fileName: "candidate.pdf" });
  });

  it("rejects a declared PDF whose bytes do not match the file signature", () => {
    expect(() => validateUploadedFile({
      data: Buffer.from("not a PDF"),
      fileName: "candidate.pdf",
      mimeType: "application/pdf",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toThrow("File content does not match declared type");
  });

  it("accepts an RTF resume only when it has an RTF header", () => {
    expect(validateUploadedFile({
      data: Buffer.from("{\\rtf1\\ansi Candidate Resume\\par Skills: TypeScript}", "utf8"),
      fileName: "candidate.rtf",
      mimeType: "text/rtf",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toMatchObject({ fileName: "candidate.rtf" });

    expect(() => validateUploadedFile({
      data: Buffer.from("not actually RTF", "utf8"),
      fileName: "candidate.rtf",
      mimeType: "text/rtf",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toThrow("File content does not match declared type");
  });

  it("rejects legacy binary DOC resumes that the parser cannot read reliably", () => {
    expect(() => validateUploadedFile({
      data: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
      fileName: "legacy.doc",
      mimeType: "application/msword",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toThrow("Unsupported file type");
  });

  it("rejects oversized documents before storage", () => {
    expect(() => validateUploadedFile({
      data: Buffer.alloc(11 * 1024 * 1024, 1),
      fileName: "candidate.txt",
      mimeType: "text/plain",
      allowedMimeTypes: RESUME_MIME_TYPES,
    })).toThrow("Uploaded file is too large");
  });
});
