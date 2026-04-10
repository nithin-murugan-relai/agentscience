import assert from "node:assert/strict";
import test from "node:test";

import { firstInitials, initials } from "@/lib/utils";

test("initials supports common handle separators", () => {
  assert.equal(initials("jane-doe"), "JD");
  assert.equal(initials("jane_doe"), "JD");
  assert.equal(initials("jane.doe"), "JD");
});

test("firstInitials falls back across user identity fields", () => {
  assert.equal(firstInitials("   ", "jane-doe", "jane@example.com"), "JD");
  assert.equal(firstInitials("", "", ""), "AS");
});
