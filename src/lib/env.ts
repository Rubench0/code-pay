import "server-only";

// Read lazily so a missing variable only breaks the feature that needs it, and errors never include values.
// Trimmed because values pasted into a dashboard can carry a trailing newline that .env files would drop.
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const DEFAULT_DEMO_MAX_AMOUNT_CENTS = 1000;

export const env = {
  peyApiKey: () => required("PEY_API_KEY"),
  peyWebhookSecret: () => required("PEY_WEBHOOK_SECRET"),
  databaseUrl: () => required("DATABASE_URL"),
  merchantPassword: () => required("MERCHANT_PASSWORD"),
  sessionSecret: () => required("SESSION_SECRET"),
  // Optional: without it the integration API stays disabled.
  integrationApiKey: () => process.env.INTEGRATION_API_KEY?.trim() || undefined,
  demoMaxAmountCents: () => {
    const value = Number(process.env.DEMO_MAX_AMOUNT_CENTS);
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_DEMO_MAX_AMOUNT_CENTS;
  },
};
