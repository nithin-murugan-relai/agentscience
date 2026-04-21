import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

test("POST /api/auth/device/[code] rejects cross-site origins before approval", async () => {
  const response = await POST(
    new Request("http://localhost/api/auth/device/ABCD-1234", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    }),
    {
      params: Promise.resolve({ code: "ABCD-1234" }),
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Invalid request origin.",
  });
});
