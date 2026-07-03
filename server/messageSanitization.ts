export const MAX_FOLLOW_UP_MESSAGE_CHARS = 10_000;

export function sanitizeFollowUpMessage(message: string): string {
  const sanitized = message
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  if (!sanitized) {
    throw new Error("Follow-up message cannot be empty.");
  }
  if (sanitized.length > MAX_FOLLOW_UP_MESSAGE_CHARS) {
    throw new Error(`Follow-up message cannot exceed ${MAX_FOLLOW_UP_MESSAGE_CHARS} characters.`);
  }
  return sanitized;
}
