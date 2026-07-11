import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./_core/cookies";

describe("session cookie options", () => {
  it("uses lax cookies on local non-secure requests so browsers keep the session", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: {},
    } as Request);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("uses none and secure on HTTPS requests for cross-site OAuth redirects", () => {
    const options = getSessionCookieOptions({
      protocol: "https",
      headers: {},
    } as Request);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });
});
