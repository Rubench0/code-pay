import "server-only";
import { Webhook } from "standardwebhooks";
import { env } from "@/lib/env";

export class WebhookSignatureError extends Error {}

// Must receive the raw body: re-serialized JSON would not match the signature.
export function verifyWebhook(rawBody: string, headers: Headers): { webhookId: string; payload: unknown } {
  const webhookId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!webhookId || !timestamp || !signature) throw new WebhookSignatureError();

  const verifier = new Webhook(env.peyWebhookSecret());
  try {
    const payload = verifier.verify(rawBody, {
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });
    return { webhookId, payload };
  } catch {
    throw new WebhookSignatureError();
  }
}
