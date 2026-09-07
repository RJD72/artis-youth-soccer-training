import { jest } from "@jest/globals";

// Every suite must explicitly replace the external boundaries it exercises.
// An accidental new import fails before a database pool or provider is used.
jest.doMock("@/db", () => {
  throw new Error("Tests must explicitly mock the database boundary.");
});
jest.doMock("@/lib/auth", () => {
  throw new Error("Tests must explicitly mock the authentication boundary.");
});
jest.doMock("@/lib/stripe", () => ({
  getStripeClient() {
    throw new Error("Tests must explicitly mock the Stripe boundary.");
  },
}));
jest.doMock("resend", () => ({
  Resend: class {
    emails = {
      send() {
        throw new Error("Tests must explicitly mock the Resend boundary.");
      },
    };
  },
}));
