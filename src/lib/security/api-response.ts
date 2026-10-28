import "server-only";

import { NextResponse } from "next/server";
import { maskDeep } from "./redact";

/**
 * The only way /api routes should return JSON (enforced by eslint). Every string
 * in the body is passed through the leak masker before it leaves the server.
 */
export function maskedJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(maskDeep(body), init);
}
