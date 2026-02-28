import { afterEach, describe, expect, it } from "vitest";
import { SquarePaymentProvider } from "~/services/payments/square.server";

const ORIGINAL_ENV = {
  SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
  SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
  SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
};

function restoreEnv() {
  process.env.SQUARE_APPLICATION_ID = ORIGINAL_ENV.SQUARE_APPLICATION_ID;
  process.env.SQUARE_LOCATION_ID = ORIGINAL_ENV.SQUARE_LOCATION_ID;
  process.env.SQUARE_ACCESS_TOKEN = ORIGINAL_ENV.SQUARE_ACCESS_TOKEN;
  process.env.SQUARE_ENVIRONMENT = ORIGINAL_ENV.SQUARE_ENVIRONMENT;
}

describe("SquarePaymentProvider CSP domains", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("includes required Square Web SDK and PCI endpoints", () => {
    process.env.SQUARE_APPLICATION_ID = "sandbox-sq0idb-test-app-id";
    process.env.SQUARE_LOCATION_ID = "L1234567890";
    process.env.SQUARE_ACCESS_TOKEN = "test-access-token";
    process.env.SQUARE_ENVIRONMENT = "sandbox";

    const provider = new SquarePaymentProvider();
    const domains = provider.getCSPDomains();

    expect(domains.scriptSrc).toEqual(
      expect.arrayContaining([
        "https://js.squareup.com",
        "https://js.squareupsandbox.com",
        "https://sandbox.web.squarecdn.com",
      ]),
    );
    expect(domains.connectSrc).toEqual(
      expect.arrayContaining([
        "https://connect.squareup.com",
        "https://connect.squareupsandbox.com",
        "https://pci-connect.squareup.com",
        "https://pci-connect.squareupsandbox.com",
      ]),
    );
    expect(domains.frameSrc).toEqual(
      expect.arrayContaining([
        "https://js.squareup.com",
        "https://js.squareupsandbox.com",
      ]),
    );
  });
});
