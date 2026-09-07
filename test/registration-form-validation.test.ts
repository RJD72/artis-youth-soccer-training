import { describe, expect, it } from "@jest/globals";

import { validateRegistrationSubmission } from "@/lib/registration-form-validation";

const validFields: Readonly<Record<string, string>> = {
  trainingGroupId: "1",
  programPackageId: "2",
  childFirstName: "Maya",
  childLastName: "Singh",
  dateOfBirth: "2015-06-15",
  preferredName: "May",
  jerseySize: "medium",
  currentPlayingLevel: "beginner",
  currentTeamOrClub: "Huron United",
  medicalInformation: "No known medical concerns.",
  coachInformation: "Works best with clear instructions.",
  guardianFirstName: "Priya",
  guardianLastName: "Singh",
  guardianRelationship: "Mother",
  email: "priya@example.com",
  primaryPhone: "(519) 555-0123",
  secondaryPhone: "519-555-0199",
  preferredContactMethod: "email",
  authorizedRegistrantConfirmed: "on",
  informationAccuracyConfirmed: "on",
  termsAccepted: "on",
  participationWaiverAccepted: "on",
  gymRulesAccepted: "on",
  paymentMethod: "stripe",
};

function createValidFormData(
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

function expectInvalid(formData: FormData) {
  const result = validateRegistrationSubmission(formData);

  expect(result.status).toBe("invalid");

  if (result.status !== "invalid") {
    throw new Error(`Expected invalid result, received ${result.status}.`);
  }

  return result.fieldErrors;
}

describe("validateRegistrationSubmission", () => {
  it("accepts and normalizes a valid registration", () => {
    const result = validateRegistrationSubmission(
      createValidFormData({
        childFirstName: "  Maya  ",
        preferredName: "  May   Singh  ",
        email: "  PRIYA@EXAMPLE.COM  ",
        medicalInformation: "  First line  \r\n\r\n\r\n  Second line  ",
      }),
    );

    expect(result.status).toBe("valid");

    if (result.status !== "valid") {
      throw new Error(`Expected valid result, received ${result.status}.`);
    }

    expect(result.data).toMatchObject({
      trainingGroupId: 1,
      programPackageId: 2,
      childFirstName: "Maya",
      preferredName: "May Singh",
      email: "priya@example.com",
      medicalInformation: "First line\n\nSecond line",
      usesDifferentEmergencyContact: false,
      emergencyContactName: "Priya Singh",
      emergencyContactRelationship: "Mother",
      emergencyContactPhone: "(519) 555-0123",
      marketingConsent: false,
      photoVideoConsent: false,
      paymentMethod: "stripe",
    });
  });

  it("uses a different emergency contact when selected", () => {
    const result = validateRegistrationSubmission(
      createValidFormData({
        emergencyContactDifferent: "on",
        emergencyContactName: "Daniel Singh",
        emergencyContactRelationship: "Father",
        emergencyContactPhone: "519-555-0142",
      }),
    );

    expect(result.status).toBe("valid");

    if (result.status !== "valid") {
      throw new Error(`Expected valid result, received ${result.status}.`);
    }

    expect(result.data).toMatchObject({
      usesDifferentEmergencyContact: true,
      emergencyContactName: "Daniel Singh",
      emergencyContactRelationship: "Father",
      emergencyContactPhone: "519-555-0142",
    });
  });

  it("reports missing required text and selection fields separately", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({
        childFirstName: null,
        paymentMethod: null,
      }),
    );

    expect(fieldErrors.childFirstName).toBeDefined();
    expect(fieldErrors.paymentMethod).toBe("Choose a payment method.");
  });

  it("requires every mandatory acknowledgement", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({
        authorizedRegistrantConfirmed: null,
        informationAccuracyConfirmed: null,
        termsAccepted: null,
        participationWaiverAccepted: null,
        gymRulesAccepted: null,
      }),
    );

    expect(fieldErrors.authorizedRegistrantConfirmed).toBeDefined();
    expect(fieldErrors.informationAccuracyConfirmed).toBeDefined();
    expect(fieldErrors.termsAccepted).toBe(
      "Accept the Terms and Conditions to continue.",
    );
    expect(fieldErrors.participationWaiverAccepted).toBeDefined();
    expect(fieldErrors.gymRulesAccepted).toBeDefined();
  });

  it("identifies an invalid email address", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({ email: "not-an-email" }),
    );

    expect(fieldErrors.email).toBe(
      "Enter a valid email address, such as name@example.com.",
    );
  });

  it("identifies an invalid primary phone number", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({ primaryPhone: "123" }),
    );

    expect(fieldErrors.primaryPhone).toBe(
      "Enter a valid phone number containing 7 to 15 digits.",
    );
  });

  it("allows the optional secondary phone number to be blank", () => {
    const result = validateRegistrationSubmission(
      createValidFormData({ secondaryPhone: "" }),
    );

    expect(result.status).toBe("valid");

    if (result.status !== "valid") {
      throw new Error(`Expected valid result, received ${result.status}.`);
    }

    expect(result.data.secondaryPhone).toBeNull();
  });

  it("identifies an invalid optional secondary phone number", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({ secondaryPhone: "call me" }),
    );

    expect(fieldErrors.secondaryPhone).toBe(
      "Enter a valid phone number containing 7 to 15 digits, or leave this field blank.",
    );
  });

  it.each(["2999-01-01", "2024-02-30", "06/15/2015"])(
    "rejects the invalid birth date %s",
    (dateOfBirth) => {
      const fieldErrors = expectInvalid(createValidFormData({ dateOfBirth }));

      expect(fieldErrors.dateOfBirth).toBe(
        "Enter a valid birth date earlier than today.",
      );
    },
  );

  it("requires all different emergency-contact fields", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({ emergencyContactDifferent: "on" }),
    );

    expect(fieldErrors.emergencyContactName).toBeDefined();
    expect(fieldErrors.emergencyContactRelationship).toBeDefined();
    expect(fieldErrors.emergencyContactPhone).toBeDefined();
  });

  it("rejects invalid IDs and option values", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({
        trainingGroupId: "0",
        programPackageId: "2.5",
        jerseySize: "huge",
        preferredContactMethod: "carrier_pigeon",
        paymentMethod: "cash",
      }),
    );

    expect(fieldErrors).toMatchObject({
      trainingGroupId: "Choose a training group.",
      programPackageId: "Choose a program term.",
      jerseySize: "Choose a valid jersey size or leave this field blank.",
      preferredContactMethod: "Choose a preferred contact method.",
      paymentMethod: "Choose a payment method.",
    });
  });

  it("rejects combined names that exceed the database limit", () => {
    const fieldErrors = expectInvalid(
      createValidFormData({
        childFirstName: "A".repeat(50),
        childLastName: "B".repeat(50),
      }),
    );

    expect(fieldErrors.childLastName).toBe(
      "The player’s combined first and last name must not exceed 100 characters.",
    );
  });

  it("treats a filled honeypot as spam", () => {
    const result = validateRegistrationSubmission(
      createValidFormData({ website: "https://spam.example" }),
    );

    expect(result).toEqual({ status: "spam" });
  });

  it("rejects duplicate values for a single-value field", () => {
    const formData = createValidFormData();
    formData.append("email", "attacker@example.com");

    const fieldErrors = expectInvalid(formData);

    expect(fieldErrors.email).toBe("Enter the guardian’s email address.");
  });
});
