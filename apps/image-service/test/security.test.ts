import { describe, expect, it } from "vitest";
import { signCallback, verifyInternalKey } from "../src/security.js";
import { falFinalizeRequestSchema } from "../src/types.js";

describe("internal security", () => {
  it("uses deterministic HMAC signatures", () => {
    expect(signCallback('{"ok":true}', "test-secret")).toHaveLength(64);
    expect(signCallback('{"ok":true}', "test-secret")).toBe(
      signCallback('{"ok":true}', "test-secret"),
    );
  });

  it("compares internal keys safely", () => {
    expect(verifyInternalKey("same-key", "same-key")).toBe(true);
    expect(verifyInternalKey("wrong", "same-key")).toBe(false);
    expect(verifyInternalKey(undefined, "same-key")).toBe(false);
  });

  it("accepts a successful FAL webhook with a nullable error field", () => {
    expect(
      falFinalizeRequestSchema.safeParse({
        jobId: "019fc95a-914a-71e2-b8a2-6299ed962f92",
        requestId: "019fc95a-a657-7743-8260-5c6bab00b07d",
        status: "OK",
        payload: { image: { url: "https://fal.media/result.png" } },
        error: null,
      }).success,
    ).toBe(true);
  });
});
