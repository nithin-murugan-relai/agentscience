import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPathWithNext,
  getSafeRedirectPath,
  getSafeRedirectFromSearchParams,
  validateBrowserOrigin,
} from "@/lib/request";

test("getSafeRedirectPath only allows same-site relative paths", () => {
  assert.equal(getSafeRedirectPath("/papers/example"), "/papers/example");
  assert.equal(getSafeRedirectPath("/papers/example?tab=reviews"), "/papers/example?tab=reviews");
  assert.equal(getSafeRedirectPath("https://evil.example/phish"), "/");
  assert.equal(getSafeRedirectPath("//evil.example/phish"), "/");
  assert.equal(getSafeRedirectPath("javascript:alert(1)"), "/");
  assert.equal(getSafeRedirectPath("/sign-in"), "/");
  assert.equal(getSafeRedirectPath("/api/papers"), "/");
});

test("getSafeRedirectFromSearchParams resolves safe next paths", () => {
  assert.equal(
    getSafeRedirectFromSearchParams({ redirect_url: "/settings?tab=keys" }),
    "/settings?tab=keys"
  );
  assert.equal(
    getSafeRedirectFromSearchParams({ redirect_url: "https://evil.example" }),
    "/"
  );
  assert.equal(
    getSafeRedirectFromSearchParams({ next: "/legacy-path" }),
    "/legacy-path"
  );
});

test("buildPathWithNext appends safe next values only", () => {
  assert.equal(
    buildPathWithNext("/sign-in", "/publish"),
    "/sign-in?redirect_url=%2Fpublish"
  );
  assert.equal(buildPathWithNext("/sign-up", "https://evil.example"), "/sign-up");
});

test("validateBrowserOrigin accepts same-site host aliases from request headers", () => {
  const request = new Request("http://localhost:3005/sign-up", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3005",
      host: "127.0.0.1:3005",
    },
  });

  assert.equal(validateBrowserOrigin(request), null);
});

test("validateBrowserOrigin rejects cross-site origins", () => {
  const request = new Request("https://agent-science.example/sign-up", {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      host: "agent-science.example",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(validateBrowserOrigin(request), "Invalid request origin.");
});
