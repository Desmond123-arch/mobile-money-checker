const APOSTROPHES = /[‘’‛ʼ′´`]/g;
const QUOTES = /[“”„]/g;
const SPACES = /[\s   -​  　﻿]+/g;

/** Straighten typographic quotes and collapse every run of whitespace to one space, so templates match one spelling. */
export function normalizeBody(body: string): string {
  return body.replace(APOSTROPHES, "'").replace(QUOTES, '"').replace(SPACES, ' ').trim();
}
