import assert from "node:assert/strict";
import test from "node:test";

import { parsePositiveInt } from "@/lib/public-api";

test("parsePositiveInt applies fallback and max bounds", () => {
  assert.equal(parsePositiveInt(undefined, 7), 7);
  assert.equal(parsePositiveInt("-1", 7), 7);
  assert.equal(parsePositiveInt("12", 7), 12);
  assert.equal(parsePositiveInt("120", 7, 25), 25);
});
