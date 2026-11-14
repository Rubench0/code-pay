import { handleWebhook } from "@/lib/charges/service";
import { verifyWebhook, WebhookSignatureError } from "@/lib/pey/webhook";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let verified: ReturnType<typeof verifyWebhook>;
  try {
    verified = verifyWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return new Response(null, { status: 401 });
    throw error;
  }

  await handleWebhook(verified.webhookId, verified.payload);
  return new Response(null, { status: 200 });
}
