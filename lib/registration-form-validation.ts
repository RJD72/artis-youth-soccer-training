// This server-only helper validates and normalizes every value submitted by
// the full registration form. The browser form improves usability, but this
// file is the security boundary because a visitor can bypass browser checks.

import "server-only";

export type PreferredContactMethod = "email" | "phone" | "text";

export type RegistrationPaymentMethod = "stripe" | "e_transfer";

export type ValidatedRegistrationSubmission = {
  trainingGroupId: number;
  programPackageId: number;
  childFirstName: string;
  childLastName: string;
  dateOfBirth: string;
  preferredName: string | null;
  currentPlayingLevel: string;
  currentTeamOrClub: string | null;
  medicalInformation: string | null;
  coachInformation: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianRelationship: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  preferredContactMethod: PreferredContactMethod;
  usesDifferentEmergencyContact: boolean;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  authorizedRegistrantConfirmed: true;
  informationAccuracyConfirmed: true;
  termsAccepted: true;
  participationWaiverAccepted: true;
  gymRulesAccepted: true;
  marketingConsent: boolean;
  photoVideoConsent: boolean;
  paymentMethod: RegistrationPaymentMethod;
};

export type RegistrationSubmissionValidation =
  | {
      status: "valid";
      data: ValidatedRegistrationSubmission;
    }
  | {
      status: "invalid";
    }
  | {
      status: "spam";
    };

type ParsedValue<T> =
  | {
      valid: true;
      value: T;
    }
  | {
      valid: false;
    };

const invalidValue: ParsedValue<never> = { valid: false };

function validValue<T>(value: T): ParsedValue<T> {
  return { valid: true, value };
}

function normalizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readOptionalText(
  formData: FormData,
  fieldName: string,
  maximumLength: number,
  multiline = false,
): ParsedValue<string | null> {
  const values = formData.getAll(fieldName);

  if (values.length === 0) {
    return validValue(null);
  }

  if (values.length !== 1 || typeof values[0] !== "string") {
    return invalidValue;
  }

  const value = multiline
    ? normalizeMultiline(values[0])
    : normalizeSingleLine(values[0]);

  if (value === "") {
    return validValue(null);
  }

  if (value.length > maximumLength) {
    return invalidValue;
  }

  return validValue(value);
}

function readRequiredText(
  formData: FormData,
  fieldName: string,
  maximumLength: number,
): ParsedValue<string> {
  const result = readOptionalText(formData, fieldName, maximumLength);

  if (!result.valid || result.value === null) {
    return invalidValue;
  }

  return validValue(result.value);
}

function readPositiveInteger(
  formData: FormData,
  fieldName: string,
): ParsedValue<number> {
  const result = readRequiredText(formData, fieldName, 10);

  if (!result.valid || !/^[1-9]\d*$/.test(result.value)) {
    return invalidValue;
  }

  const value = Number(result.value);

  if (!Number.isSafeInteger(value) || value > 4_294_967_295) {
    return invalidValue;
  }

  return validValue(value);
}

function readCheckbox(
  formData: FormData,
  fieldName: string,
): ParsedValue<boolean> {
  const values = formData.getAll(fieldName);

  if (values.length === 0) {
    return validValue(false);
  }

  if (
    values.length !== 1 ||
    typeof values[0] !== "string" ||
    !["1", "on", "true"].includes(values[0])
  ) {
    return invalidValue;
  }

  return validValue(true);
}

function readEnum<const T extends readonly string[]>(
  formData: FormData,
  fieldName: string,
  allowedValues: T,
): ParsedValue<T[number]> {
  const result = readRequiredText(formData, fieldName, 30);

  if (!result.valid || !allowedValues.includes(result.value)) {
    return invalidValue;
  }

  return validValue(result.value as T[number]);
}

function isValidEmail(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPhone(value: string): boolean {
  if (!/^[0-9()+\-.\s]+$/.test(value)) {
    return false;
  }

  const digitCount = value.replace(/\D/g, "").length;

  return digitCount >= 7 && digitCount <= 15;
}

function isValidPastDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return date.getTime() < todayUtc;
}

function isHoneypotFilled(formData: FormData): boolean {
  const values = formData.getAll("website");

  if (values.length === 0) {
    return false;
  }

  return (
    values.length !== 1 ||
    typeof values[0] !== "string" ||
    values[0].trim() !== ""
  );
}

export function validateRegistrationSubmission(
  formData: FormData,
): RegistrationSubmissionValidation {
  if (isHoneypotFilled(formData)) {
    return { status: "spam" };
  }

  const trainingGroupId = readPositiveInteger(formData, "trainingGroupId");
  const programPackageId = readPositiveInteger(formData, "programPackageId");
  const childFirstName = readRequiredText(formData, "childFirstName", 50);
  const childLastName = readRequiredText(formData, "childLastName", 50);
  const dateOfBirth = readRequiredText(formData, "dateOfBirth", 10);
  const preferredName = readOptionalText(formData, "preferredName", 50);
  const currentPlayingLevel = readRequiredText(
    formData,
    "currentPlayingLevel",
    100,
  );
  const currentTeamOrClub = readOptionalText(
    formData,
    "currentTeamOrClub",
    100,
  );
  const medicalInformation = readOptionalText(
    formData,
    "medicalInformation",
    2_000,
    true,
  );
  const coachInformation = readOptionalText(
    formData,
    "coachInformation",
    2_000,
    true,
  );
  const guardianFirstName = readRequiredText(formData, "guardianFirstName", 50);
  const guardianLastName = readRequiredText(formData, "guardianLastName", 50);
  const guardianRelationship = readRequiredText(
    formData,
    "guardianRelationship",
    50,
  );
  const email = readRequiredText(formData, "email", 254);
  const primaryPhone = readRequiredText(formData, "primaryPhone", 30);
  const secondaryPhone = readOptionalText(formData, "secondaryPhone", 30);
  const preferredContactMethod = readEnum(formData, "preferredContactMethod", [
    "email",
    "phone",
    "text",
  ] as const);
  const usesDifferentEmergencyContact = readCheckbox(
    formData,
    "emergencyContactDifferent",
  );
  const emergencyContactName = readOptionalText(
    formData,
    "emergencyContactName",
    100,
  );
  const emergencyContactRelationship = readOptionalText(
    formData,
    "emergencyContactRelationship",
    50,
  );
  const emergencyContactPhone = readOptionalText(
    formData,
    "emergencyContactPhone",
    30,
  );
  const authorizedRegistrantConfirmed = readCheckbox(
    formData,
    "authorizedRegistrantConfirmed",
  );
  const informationAccuracyConfirmed = readCheckbox(
    formData,
    "informationAccuracyConfirmed",
  );
  const termsAccepted = readCheckbox(formData, "termsAccepted");
  const participationWaiverAccepted = readCheckbox(
    formData,
    "participationWaiverAccepted",
  );
  const gymRulesAccepted = readCheckbox(formData, "gymRulesAccepted");
  const marketingConsent = readCheckbox(formData, "marketingConsent");
  const photoVideoConsent = readCheckbox(formData, "photoVideoConsent");
  const paymentMethod = readEnum(formData, "paymentMethod", [
    "stripe",
    "e_transfer",
  ] as const);

  const results = [
    trainingGroupId,
    programPackageId,
    childFirstName,
    childLastName,
    dateOfBirth,
    preferredName,
    currentPlayingLevel,
    currentTeamOrClub,
    medicalInformation,
    coachInformation,
    guardianFirstName,
    guardianLastName,
    guardianRelationship,
    email,
    primaryPhone,
    secondaryPhone,
    preferredContactMethod,
    usesDifferentEmergencyContact,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
    authorizedRegistrantConfirmed,
    informationAccuracyConfirmed,
    termsAccepted,
    participationWaiverAccepted,
    gymRulesAccepted,
    marketingConsent,
    photoVideoConsent,
    paymentMethod,
  ];

  if (results.some((result) => !result.valid)) {
    return { status: "invalid" };
  }

  // TypeScript cannot infer that checking the collection above narrowed every
  // individual result, so this guard preserves that fact for the code below.
  if (
    !trainingGroupId.valid ||
    !programPackageId.valid ||
    !childFirstName.valid ||
    !childLastName.valid ||
    !dateOfBirth.valid ||
    !preferredName.valid ||
    !currentPlayingLevel.valid ||
    !currentTeamOrClub.valid ||
    !medicalInformation.valid ||
    !coachInformation.valid ||
    !guardianFirstName.valid ||
    !guardianLastName.valid ||
    !guardianRelationship.valid ||
    !email.valid ||
    !primaryPhone.valid ||
    !secondaryPhone.valid ||
    !preferredContactMethod.valid ||
    !usesDifferentEmergencyContact.valid ||
    !emergencyContactName.valid ||
    !emergencyContactRelationship.valid ||
    !emergencyContactPhone.valid ||
    !authorizedRegistrantConfirmed.valid ||
    !informationAccuracyConfirmed.valid ||
    !termsAccepted.valid ||
    !participationWaiverAccepted.valid ||
    !gymRulesAccepted.valid ||
    !marketingConsent.valid ||
    !photoVideoConsent.valid ||
    !paymentMethod.valid
  ) {
    return { status: "invalid" };
  }

  const normalizedEmail = email.value.toLowerCase();
  const childFullName = `${childFirstName.value} ${childLastName.value}`;
  const guardianFullName = `${guardianFirstName.value} ${guardianLastName.value}`;

  if (
    childFullName.length > 100 ||
    guardianFullName.length > 100 ||
    !isValidPastDate(dateOfBirth.value) ||
    !isValidEmail(normalizedEmail) ||
    !isValidPhone(primaryPhone.value) ||
    (secondaryPhone.value !== null && !isValidPhone(secondaryPhone.value)) ||
    !authorizedRegistrantConfirmed.value ||
    !informationAccuracyConfirmed.value ||
    !termsAccepted.value ||
    !participationWaiverAccepted.value ||
    !gymRulesAccepted.value
  ) {
    return { status: "invalid" };
  }

  let finalEmergencyContactName = guardianFullName;
  let finalEmergencyContactRelationship = guardianRelationship.value;
  let finalEmergencyContactPhone = primaryPhone.value;

  if (usesDifferentEmergencyContact.value) {
    if (
      emergencyContactName.value === null ||
      emergencyContactRelationship.value === null ||
      emergencyContactPhone.value === null ||
      !isValidPhone(emergencyContactPhone.value)
    ) {
      return { status: "invalid" };
    }

    finalEmergencyContactName = emergencyContactName.value;
    finalEmergencyContactRelationship = emergencyContactRelationship.value;
    finalEmergencyContactPhone = emergencyContactPhone.value;
  }

  return {
    status: "valid",
    data: {
      trainingGroupId: trainingGroupId.value,
      programPackageId: programPackageId.value,
      childFirstName: childFirstName.value,
      childLastName: childLastName.value,
      dateOfBirth: dateOfBirth.value,
      preferredName: preferredName.value,
      currentPlayingLevel: currentPlayingLevel.value,
      currentTeamOrClub: currentTeamOrClub.value,
      medicalInformation: medicalInformation.value,
      coachInformation: coachInformation.value,
      guardianFirstName: guardianFirstName.value,
      guardianLastName: guardianLastName.value,
      guardianRelationship: guardianRelationship.value,
      email: normalizedEmail,
      primaryPhone: primaryPhone.value,
      secondaryPhone: secondaryPhone.value,
      preferredContactMethod: preferredContactMethod.value,
      usesDifferentEmergencyContact: usesDifferentEmergencyContact.value,
      emergencyContactName: finalEmergencyContactName,
      emergencyContactRelationship: finalEmergencyContactRelationship,
      emergencyContactPhone: finalEmergencyContactPhone,
      authorizedRegistrantConfirmed: true,
      informationAccuracyConfirmed: true,
      termsAccepted: true,
      participationWaiverAccepted: true,
      gymRulesAccepted: true,
      marketingConsent: marketingConsent.value,
      photoVideoConsent: photoVideoConsent.value,
      paymentMethod: paymentMethod.value,
    },
  };
}
