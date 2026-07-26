import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");

test("English and Arabic locales are declared", () => {
  assert.match(source, /\["en", "ar"\]/);
});

test("Arabic locale maps to RTL", () => {
  assert.match(source, /locale === "ar" \? "rtl" : "ltr"/);
});
