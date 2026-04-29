import { describe, expect, it } from "vitest";
import { getSquarePaymentConfirmationUserMessage } from "~/services/payments/square.server";

describe("Square payment confirmation errors", () => {
  it("maps Square authentication failures to a safe support message", () => {
    const error = Object.assign(
      new Error('Status code: 401 Body: { "errors": [{ "code": "UNAUTHORIZED" }] }'),
      {
        statusCode: 401,
        errors: [
          {
            category: "AUTHENTICATION_ERROR",
            code: "UNAUTHORIZED",
            detail: "This request could not be authorized.",
          },
        ],
      },
    );

    const message = getSquarePaymentConfirmationUserMessage(error);

    expect(message).toBe(
      "Payment processor authentication is misconfigured. Please contact support so we can complete this payment.",
    );
    expect(message).not.toContain("Square");
    expect(message).not.toContain("UNAUTHORIZED");
    expect(message).not.toContain("Status code");
  });

  it("recognizes Square authentication errors nested in the response body", () => {
    const message = getSquarePaymentConfirmationUserMessage({
      body: {
        errors: [
          {
            category: "AUTHENTICATION_ERROR",
            code: "ACCESS_TOKEN_REVOKED",
          },
        ],
      },
    });

    expect(message).toBe(
      "Payment processor authentication is misconfigured. Please contact support so we can complete this payment.",
    );
  });

  it("keeps payment method failures actionable for the payer", () => {
    const message = getSquarePaymentConfirmationUserMessage({
      errors: [
        {
          category: "PAYMENT_METHOD_ERROR",
          code: "CARD_DECLINED",
        },
      ],
    });

    expect(message).toBe("Payment was declined. Please try a different payment method.");
  });
});
