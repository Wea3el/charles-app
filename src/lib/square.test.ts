import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./square.ts";

test("webhook signature: HMAC of URL + body with the signature key", () => {
  const url = "https://shop.example/api/square/webhook";
  const body = '{"type":"payment.updated"}';
  const good = createHmac("sha256", "key123").update(url + body).digest("base64");
  assert.equal(verifyWebhookSignature(body, good, url, "key123"), true);
  assert.equal(verifyWebhookSignature(body + " ", good, url, "key123"), false); // body changed
  assert.equal(verifyWebhookSignature(body, good, "https://other/api/square/webhook", "key123"), false); // wrong URL
  assert.equal(verifyWebhookSignature(body, good, url, "other-key"), false);
  assert.equal(verifyWebhookSignature(body, null, url, "key123"), false);
});
