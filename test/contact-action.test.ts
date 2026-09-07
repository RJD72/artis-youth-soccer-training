import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import type { ContactFormActionState } from "@/app/contact/actions";

type HeadersFunction = (typeof import("next/headers"))["headers"];
type SendContactMessageEmailFunction =
  (typeof import("@/lib/send-contact-message-email"))["sendContactMessageEmail"];
type SubmitContactMessageFunction =
  (typeof import("@/app/contact/actions"))["submitContactMessage"];

const mockedHeaders = jest.fn<HeadersFunction>();
const mockedSendContactMessageEmail =
  jest.fn<SendContactMessageEmailFunction>();
const idleState: ContactFormActionState = { status: "idle" };
let submitContactMessage: SubmitContactMessageFunction;

const validFields: Readonly<Record<string, string>> = {
  fullName: "Taylor Morgan",
  email: "taylor@example.com",
  phone: "(519) 555-0123 ext 4",
  enquiryType: "Training",
  message: "I would like more information about the training program.",
};

function createContactFormData(
  overrides: Record<string, string | null> = {},
): FormData {
  const formData = new FormData();
  const fields = { ...validFields, ...overrides };

  for (const [name, value] of Object.entries(fields)) {
    if (value !== null) {
      formData.append(name, value);
    }
  }

  return formData;
}

function createRequestHeaders(
  values: Record<string, string> = {},
): Awaited<ReturnType<HeadersFunction>> {
  return new Headers(values) as Awaited<ReturnType<HeadersFunction>>;
}

beforeAll(async () => {
  jest.doMock("next/headers", () => ({ headers: mockedHeaders }));
  jest.doMock("@/lib/send-contact-message-email", () => ({
    sendContactMessageEmail: mockedSendContactMessageEmail,
  }));

  ({ submitContactMessage } = await import("@/app/contact/actions"));
});

beforeEach(() => {
  jest.restoreAllMocks();
  mockedHeaders.mockReset();
  mockedSendContactMessageEmail.mockReset();
  mockedHeaders.mockResolvedValue(createRequestHeaders());
  mockedSendContactMessageEmail.mockResolvedValue(undefined);
});

describe("submitContactMessage", () => {
  it("normalizes and sends a valid contact submission", async () => {
    const result = await submitContactMessage(
      idleState,
      createContactFormData({
        fullName: "  Taylor   Morgan  ",
        email: "  TAYLOR.VALID@EXAMPLE.COM  ",
        message: "  First line\r\nSecond line  ",
      }),
    );

    expect(result).toEqual({ status: "success" });
    expect(mockedSendContactMessageEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendContactMessageEmail).toHaveBeenCalledWith({
      senderName: "Taylor Morgan",
      senderEmail: "taylor.valid@example.com",
      phoneNumber: "(519) 555-0123 ext 4",
      enquiryType: "Training",
      message: "First line\nSecond line",
      submittedAt: expect.any(Date),
    });
  });

  it("converts an optional blank phone number to null", async () => {
    const result = await submitContactMessage(
      idleState,
      createContactFormData({
        email: "blank-phone@example.com",
        phone: "   ",
      }),
    );

    expect(result).toEqual({ status: "success" });
    expect(mockedSendContactMessageEmail).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: null }),
    );
  });

  it("returns an error for every missing field without sending email", async () => {
    const result = await submitContactMessage(idleState, new FormData());

    expect(result).toEqual({
      status: "error",
      code: "invalid-form",
      fieldErrors: {
        fullName: "Enter your full name using between 2 and 100 characters.",
        email: "Enter a valid email address.",
        enquiryType: "Choose a valid enquiry type.",
        message: "Enter a message using between 10 and 5,000 characters.",
      },
    });
    expect(mockedSendContactMessageEmail).not.toHaveBeenCalled();
  });

  it("returns a field-specific error for a short phone number", async () => {
    const result = await submitContactMessage(
      idleState,
      createContactFormData({
        email: "short-phone@example.com",
        phone: "123",
      }),
    );

    expect(result).toEqual({
      status: "error",
      code: "invalid-form",
      fieldErrors: {
        phone:
          "Enter a valid phone number with 7 to 15 digits, or leave this field blank.",
      },
    });
    expect(mockedSendContactMessageEmail).not.toHaveBeenCalled();
  });

  it("returns unable-to-send when the email provider fails", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockedSendContactMessageEmail.mockRejectedValue(
      new Error("Private provider details"),
    );

    const result = await submitContactMessage(
      idleState,
      createContactFormData({ email: "provider-failure@example.com" }),
    );

    expect(result).toEqual({ status: "error", code: "unable-to-send" });
    expect(consoleError).toHaveBeenCalledWith("Contact form email failed.", {
      errorType: "Error",
    });
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Private provider details"),
    );
  });

  it("limits one email address to three submissions per window", async () => {
    const formData = () =>
      createContactFormData({ email: "email-limit@example.com" });

    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "success",
    });
    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "success",
    });
    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "success",
    });
    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "error",
      code: "rate-limited",
    });
    expect(mockedSendContactMessageEmail).toHaveBeenCalledTimes(3);
  });

  it("limits one IP address to five submissions per window", async () => {
    mockedHeaders.mockResolvedValue(
      createRequestHeaders({ "x-real-ip": "203.0.113.10" }),
    );

    for (let submissionNumber = 1; submissionNumber <= 5; submissionNumber++) {
      await expect(
        submitContactMessage(
          idleState,
          createContactFormData({
            email: `ip-limit-${submissionNumber}@example.com`,
          }),
        ),
      ).resolves.toEqual({ status: "success" });
    }

    await expect(
      submitContactMessage(
        idleState,
        createContactFormData({ email: "ip-limit-6@example.com" }),
      ),
    ).resolves.toEqual({ status: "error", code: "rate-limited" });
    expect(mockedSendContactMessageEmail).toHaveBeenCalledTimes(5);
  });

  it("allows submissions again after the ten-minute window", async () => {
    let currentTime = 1_800_000_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => currentTime);
    const formData = () =>
      createContactFormData({ email: "expired-limit@example.com" });

    await submitContactMessage(idleState, formData());
    await submitContactMessage(idleState, formData());
    await submitContactMessage(idleState, formData());

    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "error",
      code: "rate-limited",
    });

    currentTime += 10 * 60 * 1_000 + 1;

    await expect(submitContactMessage(idleState, formData())).resolves.toEqual({
      status: "success",
    });
  });
});
