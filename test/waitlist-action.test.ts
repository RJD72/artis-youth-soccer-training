import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { registrations, trainingGroups, waitlistEntries } from "@/db/schema";

import { databaseHarness } from "./database-harness";

const h = databaseHarness();

const redirect = jest.fn((url: string): never => {
  throw new Error(`redirect:${url}`);
});

const createWaitlistConfirmationReference = jest.fn((_entryId: number) => ({
  entry: "1",
  expires: "1234567890",
  signature: "test-signature",
}));

let joinWaitlist: typeof import("@/app/register/waitlist/action").joinWaitlist;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: h.db,
  }));

  jest.doMock("next/navigation", () => ({
    redirect,
  }));

  jest.doMock("@/lib/waitlist-confirmation", () => ({
    createWaitlistConfirmationReference,
  }));

  ({ joinWaitlist } = await import("@/app/register/waitlist/action"));
});

beforeEach(() => {
  h.reset();
  redirect.mockClear();
  createWaitlistConfirmationReference.mockClear();
});

function createWaitlistForm() {
  const formData = new FormData();

  formData.set("trainingGroup", "ages-8-10");
  formData.set("childFirstName", "Charlie");
  formData.set("childLastName", "Smith");
  formData.set("guardianName", "Taylor Smith");
  formData.set("email", "parent@example.com");
  formData.set("phoneNumber", "519-555-0123");
  formData.set("notes", "");
  formData.set("website", "");

  return formData;
}

describe("public waitlist action", () => {
  it("allows the waitlist when registration is closed even if capacity remains", async () => {
    h.read(trainingGroups, {
      id: 1,
      slug: "ages-8-10",
      capacity: 30,
      registrationOpen: false,
    });

    h.read(registrations, {
      occupiedSpots: 0,
    });

    h.read(waitlistEntries);

    await expect(joinWaitlist(createWaitlistForm())).rejects.toThrow(
      "redirect:/register/waitlist/confirmation?entry=1&expires=1234567890&signature=test-signature",
    );

    const writes = h.writes(waitlistEntries);

    expect(writes).toHaveLength(1);

    expect(writes[0].values).toEqual({
      trainingGroupId: 1,
      childFirstName: "Charlie",
      childLastName: "Smith",
      guardianFullName: "Taylor Smith",
      email: "parent@example.com",
      phone: "519-555-0123",
      notes: null,
      status: "waiting",
    });

    expect(createWaitlistConfirmationReference).toHaveBeenCalledWith(1);
  });
});
