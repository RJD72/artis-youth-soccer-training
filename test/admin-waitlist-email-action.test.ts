import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { waitlistEntries } from "@/db/schema";

import { databaseHarness } from "./database-harness";

const h = databaseHarness();

const requireAdminSession = jest.fn<() => Promise<unknown>>();

type SendAdminMessageEmailFunction =
  (typeof import("@/lib/send-admin-message-email"))["sendAdminMessageEmail"];

const sendAdminMessageEmail = jest.fn<SendAdminMessageEmailFunction>();

const revalidatePath = jest.fn<(path: string) => void>();

let sendWaitlistEntryEmail: typeof import("@/app/admin/waitlist/actions").sendWaitlistEntryEmail;

let offerWaitlistSpot: typeof import("@/app/admin/waitlist/actions").offerWaitlistSpot;

const initialState = {
  status: "idle" as const,
  message: "",
};

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: h.db,
  }));

  jest.doMock("@/lib/admin-auth", () => ({
    requireAdminSession,
  }));

  jest.doMock("@/lib/send-admin-message-email", () => ({
    sendAdminMessageEmail,
  }));

  jest.doMock("next/cache", () => ({
    revalidatePath,
  }));

  ({ sendWaitlistEntryEmail, offerWaitlistSpot } =
    await import("@/app/admin/waitlist/actions"));
});

beforeEach(() => {
  h.reset();

  requireAdminSession.mockResolvedValue(undefined);
});

function createEmailFormData({
  waitlistEntryId = "1",
  subject = "Test subject",
  message = "Test message",
}: {
  waitlistEntryId?: string;
  subject?: string;
  message?: string;
} = {}) {
  const formData = new FormData();

  formData.set("waitlistEntryId", waitlistEntryId);
  formData.set("subject", subject);
  formData.set("message", message);

  return formData;
}

function createOfferFormData(waitlistEntryId = "1") {
  const formData = new FormData();

  formData.set("waitlistEntryId", waitlistEntryId);

  return formData;
}

describe("admin waitlist email action", () => {
  it("requires an administrator before validating or reading data", async () => {
    requireAdminSession.mockRejectedValueOnce(
      new Error("Administrator access required."),
    );

    const formData = createEmailFormData({
      waitlistEntryId: "bad",
    });

    await expect(
      sendWaitlistEntryEmail(initialState, formData),
    ).rejects.toThrow("Administrator access required.");

    expect(h.queries(waitlistEntries)).toHaveLength(0);
    expect(h.writes(waitlistEntries)).toHaveLength(0);
    expect(sendAdminMessageEmail).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "bad"])(
    "rejects invalid waitlist entry ID %s",
    async (waitlistEntryId) => {
      const result = await sendWaitlistEntryEmail(
        initialState,
        createEmailFormData({
          waitlistEntryId,
        }),
      );

      expect(result.status).toBe("error");

      expect(h.queries(waitlistEntries)).toHaveLength(0);
      expect(h.writes(waitlistEntries)).toHaveLength(0);
      expect(sendAdminMessageEmail).not.toHaveBeenCalled();
    },
  );

  it("rejects an empty subject or message before reading the database", async () => {
    const missingSubject = await sendWaitlistEntryEmail(
      initialState,
      createEmailFormData({
        subject: "",
      }),
    );

    expect(missingSubject.status).toBe("error");

    const missingMessage = await sendWaitlistEntryEmail(
      initialState,
      createEmailFormData({
        message: "",
      }),
    );

    expect(missingMessage.status).toBe("error");

    expect(h.queries(waitlistEntries)).toHaveLength(0);
    expect(h.writes(waitlistEntries)).toHaveLength(0);
    expect(sendAdminMessageEmail).not.toHaveBeenCalled();
  });

  it("does not email an inactive or missing waitlist entry", async () => {
    h.read(waitlistEntries);

    const result = await sendWaitlistEntryEmail(
      initialState,
      createEmailFormData(),
    );

    expect(result.status).toBe("error");

    expect(sendAdminMessageEmail).not.toHaveBeenCalled();
    expect(h.writes(waitlistEntries)).toHaveLength(0);
  });

  it("uses the guardian name and email stored in the database", async () => {
    h.read(waitlistEntries, {
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
    });

    const result = await sendWaitlistEntryEmail(
      initialState,
      createEmailFormData({
        subject: "Practice information",
        message: "Here is an update about the upcoming practice.",
      }),
    );

    expect(sendAdminMessageEmail).toHaveBeenCalledWith({
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
      subject: "Practice information",
      message: "Here is an update about the upcoming practice.",
    });

    expect(result).toEqual({
      status: "success",
      message: "Email sent successfully.",
    });
  });

  it("returns a safe error when the email provider fails", async () => {
    h.read(waitlistEntries, {
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
    });

    sendAdminMessageEmail.mockRejectedValueOnce(
      new Error("Private provider failure details"),
    );

    const result = await sendWaitlistEntryEmail(
      initialState,
      createEmailFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toEqual(expect.any(String));

    expect(result.message).not.toContain("Private provider failure details");
  });

  it("offers a waiting family a spot and marks them as contacted", async () => {
    h.read(waitlistEntries, {
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
      childFirstName: "Charlie",
      groupName: "Ages 8–10",
    });

    const result = await offerWaitlistSpot(initialState, createOfferFormData());

    expect(sendAdminMessageEmail).toHaveBeenCalledWith({
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
      subject: "A spot is available at ARTIS Soccer Academy",
      message: expect.stringContaining(
        "A spot is now available for Charlie in our Ages 8–10 program.",
      ),
    });

    expect(h.writes(waitlistEntries)).toHaveLength(1);

    expect(h.writes(waitlistEntries)[0].values).toEqual({
      status: "contacted",
    });

    expect(result).toEqual({
      status: "success",
      message: "Spot offer sent. The family is now marked as contacted.",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/admin/waitlist");
  });

  it("does not change the waitlist status when the spot offer email fails", async () => {
    h.read(waitlistEntries, {
      guardianName: "Taylor Smith",
      guardianEmail: "parent@example.com",
      childFirstName: "Charlie",
      groupName: "Ages 8–10",
    });

    sendAdminMessageEmail.mockRejectedValueOnce(
      new Error("Email provider unavailable"),
    );

    const result = await offerWaitlistSpot(initialState, createOfferFormData());

    expect(result).toEqual({
      status: "error",
      message: "The spot offer email could not be sent.",
    });

    expect(h.writes(waitlistEntries)).toHaveLength(0);
  });

  it("does not offer a spot to an entry that is no longer waiting", async () => {
    h.read(waitlistEntries);

    const result = await offerWaitlistSpot(initialState, createOfferFormData());

    expect(result).toEqual({
      status: "error",
      message: "This waitlist entry is no longer waiting.",
    });

    expect(sendAdminMessageEmail).not.toHaveBeenCalled();
    expect(h.writes(waitlistEntries)).toHaveLength(0);
  });
});
