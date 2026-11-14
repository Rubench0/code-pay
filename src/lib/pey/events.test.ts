import { describe, expect, it } from "vitest";
import { eventType, parsePaymentEvent, sanitizePayload } from "./events";

const pushEvent = {
  type: "codi.pn.payment_received",
  amount: 100,
  apiKeyId: "key",
  concept: "Cobro #1001",
  datePaid: 1790724758,
  numRef: "1001",
  transactionId: "01M3QR5E7XHXMNZDEPFH3JAWS0",
  metadata: {
    clabe: "000000000000000000",
    bankCode: 40012,
    accountType: 40,
    trackingKey: "TRACK",
    externalMetadata: { chargeId: "c1" },
  },
};

describe("parsePaymentEvent", () => {
  it("parses push and QR payment events", () => {
    expect(parsePaymentEvent(pushEvent)?.metadata?.externalMetadata?.chargeId).toBe("c1");
    expect(
      parsePaymentEvent({ ...pushEvent, type: "codi.qr.payment_received", codiQrId: "35a13c183a" })?.codiQrId,
    ).toBe("35a13c183a");
  });

  it("rejects QR events without codiQrId and unknown types", () => {
    expect(parsePaymentEvent({ ...pushEvent, type: "codi.qr.payment_received" })).toBeNull();
    expect(parsePaymentEvent({ ...pushEvent, type: "payment_link.status_updated" })).toBeNull();
    expect(parsePaymentEvent(null)).toBeNull();
  });
});

describe("sanitizePayload", () => {
  it("removes the payer's bank account fields and keeps the rest", () => {
    const sanitized = sanitizePayload(pushEvent) as typeof pushEvent;
    expect(sanitized.metadata).toEqual({ trackingKey: "TRACK", externalMetadata: { chargeId: "c1" } });
    expect(sanitized.transactionId).toBe(pushEvent.transactionId);
    expect(pushEvent.metadata.clabe).toBe("000000000000000000");
  });
});

describe("eventType", () => {
  it("reads the type defensively", () => {
    expect(eventType(pushEvent)).toBe("codi.pn.payment_received");
    expect(eventType({})).toBe("unknown");
    expect(eventType("x")).toBe("unknown");
  });
});
