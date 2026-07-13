import { ENV } from "./_core/env";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export interface SensitiveUploadScanResult {
  scanned: boolean;
  provider: string;
}

export const RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/rtf",
  "application/rtf",
]);

export const VERIFICATION_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/rtf",
  "application/rtf",
  "image/jpeg",
  "image/png",
]);

export function sanitizeUploadFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[/\\]/g, "_");
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "upload";
}

export function validateUploadedFile(input: {
  data: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  allowedMimeTypes: Set<string>;
  maxBytes?: number;
}) {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const data = Buffer.from(input.data);
  const sanitizedFileName = sanitizeUploadFileName(input.fileName);

  if (data.length === 0) {
    throw new Error("Uploaded file is empty");
  }

  if (data.length > maxBytes) {
    throw new Error(`Uploaded file is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)}MB`);
  }

  if (!input.allowedMimeTypes.has(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }

  if (!hasExpectedSignature(data, input.mimeType)) {
    throw new Error(`File content does not match declared type: ${input.mimeType}`);
  }

  return {
    fileName: sanitizedFileName,
    size: data.length,
  };
}

/**
 * Optional malware-scanner handoff. Production uploads fail closed until a scanner
 * endpoint is configured; local development remains explicitly unscanned.
 */
export async function scanSensitiveUpload(input: {
  data: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<SensitiveUploadScanResult> {
  const endpoint = process.env.FILE_MALWARE_SCAN_URL?.trim();
  if (!endpoint) {
    if (ENV.isProduction) {
      throw new Error("Sensitive uploads require FILE_MALWARE_SCAN_URL in production");
    }
    return { scanned: false, provider: "not_configured" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": input.mimeType,
      "x-file-name": sanitizeUploadFileName(input.fileName),
    },
    body: Buffer.from(input.data),
  });
  if (!response.ok) {
    throw new Error(`Malware scan failed with status ${response.status}`);
  }

  const result = await response.json() as { clean?: boolean; provider?: string };
  if (result.clean !== true) {
    throw new Error("Sensitive upload was rejected by the malware scanner");
  }
  return { scanned: true, provider: result.provider?.trim() || "configured_scanner" };
}

function hasExpectedSignature(data: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return data.subarray(0, 4).toString("utf8") === "%PDF";
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return data[0] === 0x50 && data[1] === 0x4b;
  }

  if (mimeType === "application/msword") {
    return data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0;
  }

  if (mimeType === "image/jpeg") {
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  }

  if (mimeType === "text/plain" || mimeType === "text/rtf" || mimeType === "application/rtf") {
    return !data.subarray(0, Math.min(data.length, 512)).includes(0);
  }

  return false;
}
