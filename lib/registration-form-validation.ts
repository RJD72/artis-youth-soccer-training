// This server-only helper validates and normalizes every value submitted by
// the full registration form. The browser form improves usability, but this
// file is the security boundary because a visitor can bypass browser checks.

import "server-only";

export type PreferredContactMethod = "email" | "phone" | "text";

export type RegistrationPaymentMethod = "stripe" | "e_transfer";

export type JerseySize = "small" | "medium" | "large" | "extra_large";

export type ValidatedRegistrationSubmission = {
  trainingGroupId: number;
  programPackageId: number;
  childFirstName: string;
  childLastName: string;
  dateOfBirth: string;
  preferredName: string | null;
  jerseySize: JerseySize | null;
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

export type RegistrationFormFieldName =
  | "trainingGroupId"
  | "programPackageId"
  | "childFirstName"
  | "childLastName"
  | "dateOfBirth"
  | "preferredName"
  | "jerseySize"
  | "currentPlayingLevel"
  | "currentTeamOrClub"
  | "medicalInformation"
  | "coachInformation"
  | "guardianFirstName"
  | "guardianLastName"
  | "guardianRelationship"
  | "email"
  | "primaryPhone"
  | "secondaryPhone"
  | "preferredContactMethod"
  | "emergencyContactDifferent"
  | "emergencyContactName"
  | "emergencyContactRelationship"
  | "emergencyContactPhone"
  | "authorizedRegistrantConfirmed"
  | "informationAccuracyConfirmed"
  | "termsAccepted"
  | "participationWaiverAccepted"
  | "gymRulesAccepted"
  | "marketingConsent"
  | "photoVideoConsent"
  | "paymentMethod";

export type RegistrationFormFieldErrors = Partial<
  Record<RegistrationFormFieldName, string>
>;

export type RegistrationSubmissionValidation =
  | {
      status: "valid";
      data: ValidatedRegistrationSubmission;
    }
  | {
      status: "invalid";
      fieldErrors: RegistrationFormFieldErrors;
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

function readOptionalEnum<const T extends readonly string[]>(
  formData: FormData,
  fieldName: string,
  allowedValues: T,
): ParsedValue<T[number] | null> {
  const result = readOptionalText(formData, fieldName, 30);

  if (!result.valid) {
    return invalidValue;
  }

  if (result.value === null) {
    return validValue(null);
  }

  if (!allowedValues.includes(result.value)) {
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

function addFieldError(
  fieldErrors: RegistrationFormFieldErrors,
  fieldName: RegistrationFormFieldName,
  message: string,
): void {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = message;
  }
}

function addParsedValueError(
  fieldErrors: RegistrationFormFieldErrors,
  fieldName: RegistrationFormFieldName,
  result: ParsedValue<unknown>,
  message: string,
): void {
  if (!result.valid) {
    addFieldError(fieldErrors, fieldName, message);
  }
}

function hasFieldErrors(fieldErrors: RegistrationFormFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
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
  const jerseySize = readOptionalEnum(formData, "jerseySize", [
    "small",
    "medium",
    "large",
    "extra_large",
  ] as const);
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

  const fieldErrors: RegistrationFormFieldErrors = {};

  addParsedValueError(
    fieldErrors,
    "trainingGroupId",
    trainingGroupId,
    "Choose a training group.",
  );
  addParsedValueError(
    fieldErrors,
    "programPackageId",
    programPackageId,
    "Choose a program term.",
  );
  addParsedValueError(
    fieldErrors,
    "childFirstName",
    childFirstName,
    "Enter the player’s first name using no more than 50 characters.",
  );
  addParsedValueError(
    fieldErrors,
    "childLastName",
    childLastName,
    "Enter the player’s last name using no more than 50 characters.",
  );
  addParsedValueError(
    fieldErrors,
    "dateOfBirth",
    dateOfBirth,
    "Enter the player’s date of birth.",
  );
  addParsedValueError(
    fieldErrors,
    "preferredName",
    preferredName,
    "Use no more than 50 characters for the preferred name.",
  );
  addParsedValueError(
    fieldErrors,
    "jerseySize",
    jerseySize,
    "Choose a valid jersey size or leave this field blank.",
  );
  addParsedValueError(
    fieldErrors,
    "currentPlayingLevel",
    currentPlayingLevel,
    "Choose the player’s current playing level.",
  );
  addParsedValueError(
    fieldErrors,
    "currentTeamOrClub",
    currentTeamOrClub,
    "Use no more than 100 characters for the team or club.",
  );
  addParsedValueError(
    fieldErrors,
    "medicalInformation",
    medicalInformation,
    "Use no more than 2,000 characters for medical information.",
  );
  addParsedValueError(
    fieldErrors,
    "coachInformation",
    coachInformation,
    "Use no more than 2,000 characters for coach information.",
  );
  addParsedValueError(
    fieldErrors,
    "guardianFirstName",
    guardianFirstName,
    "Enter the guardian’s first name using no more than 50 characters.",
  );
  addParsedValueError(
    fieldErrors,
    "guardianLastName",
    guardianLastName,
    "Enter the guardian’s last name using no more than 50 characters.",
  );
  addParsedValueError(
    fieldErrors,
    "guardianRelationship",
    guardianRelationship,
    "Choose the guardian’s relationship to the player.",
  );
  addParsedValueError(
    fieldErrors,
    "email",
    email,
    "Enter the guardian’s email address.",
  );
  addParsedValueError(
    fieldErrors,
    "primaryPhone",
    primaryPhone,
    "Enter the guardian’s primary phone number.",
  );
  addParsedValueError(
    fieldErrors,
    "secondaryPhone",
    secondaryPhone,
    "Enter a valid secondary phone number or leave this field blank.",
  );
  addParsedValueError(
    fieldErrors,
    "preferredContactMethod",
    preferredContactMethod,
    "Choose a preferred contact method.",
  );
  addParsedValueError(
    fieldErrors,
    "emergencyContactDifferent",
    usesDifferentEmergencyContact,
    "Choose whether the emergency contact is different from the guardian.",
  );
  addParsedValueError(
    fieldErrors,
    "emergencyContactName",
    emergencyContactName,
    "Use no more than 100 characters for the emergency contact’s name.",
  );
  addParsedValueError(
    fieldErrors,
    "emergencyContactRelationship",
    emergencyContactRelationship,
    "Use no more than 50 characters for the emergency contact’s relationship.",
  );
  addParsedValueError(
    fieldErrors,
    "emergencyContactPhone",
    emergencyContactPhone,
    "Enter a valid emergency phone number.",
  );
  addParsedValueError(
    fieldErrors,
    "authorizedRegistrantConfirmed",
    authorizedRegistrantConfirmed,
    "Confirm that you are authorized to register this player.",
  );
  addParsedValueError(
    fieldErrors,
    "informationAccuracyConfirmed",
    informationAccuracyConfirmed,
    "Confirm that the registration information is accurate.",
  );
  addParsedValueError(
    fieldErrors,
    "termsAccepted",
    termsAccepted,
    "Accept the Terms and Conditions to continue.",
  );
  addParsedValueError(
    fieldErrors,
    "participationWaiverAccepted",
    participationWaiverAccepted,
    "Acknowledge the Participation Waiver to continue.",
  );
  addParsedValueError(
    fieldErrors,
    "gymRulesAccepted",
    gymRulesAccepted,
    "Acknowledge the facility rules to continue.",
  );
  addParsedValueError(
    fieldErrors,
    "marketingConsent",
    marketingConsent,
    "Choose a valid marketing preference.",
  );
  addParsedValueError(
    fieldErrors,
    "photoVideoConsent",
    photoVideoConsent,
    "Choose a valid photo and video preference.",
  );
  addParsedValueError(
    fieldErrors,
    "paymentMethod",
    paymentMethod,
    "Choose a payment method.",
  );

  if (hasFieldErrors(fieldErrors)) {
    return { status: "invalid", fieldErrors };
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
    !jerseySize.valid ||
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
    return { status: "invalid", fieldErrors };
  }

  const normalizedEmail = email.value.toLowerCase();
  const childFullName = `${childFirstName.value} ${childLastName.value}`;
  const guardianFullName = `${guardianFirstName.value} ${guardianLastName.value}`;

  if (childFullName.length > 100) {
    addFieldError(
      fieldErrors,
      "childLastName",
      "The player’s combined first and last name must not exceed 100 characters.",
    );
  }

  if (guardianFullName.length > 100) {
    addFieldError(
      fieldErrors,
      "guardianLastName",
      "The guardian’s combined first and last name must not exceed 100 characters.",
    );
  }

  if (!isValidPastDate(dateOfBirth.value)) {
    addFieldError(
      fieldErrors,
      "dateOfBirth",
      "Enter a valid birth date earlier than today.",
    );
  }

  if (!isValidEmail(normalizedEmail)) {
    addFieldError(
      fieldErrors,
      "email",
      "Enter a valid email address, such as name@example.com.",
    );
  }

  if (!isValidPhone(primaryPhone.value)) {
    addFieldError(
      fieldErrors,
      "primaryPhone",
      "Enter a valid phone number containing 7 to 15 digits.",
    );
  }

  if (secondaryPhone.value !== null && !isValidPhone(secondaryPhone.value)) {
    addFieldError(
      fieldErrors,
      "secondaryPhone",
      "Enter a valid phone number containing 7 to 15 digits, or leave this field blank.",
    );
  }

  if (!authorizedRegistrantConfirmed.value) {
    addFieldError(
      fieldErrors,
      "authorizedRegistrantConfirmed",
      "Confirm that you are authorized to register this player.",
    );
  }

  if (!informationAccuracyConfirmed.value) {
    addFieldError(
      fieldErrors,
      "informationAccuracyConfirmed",
      "Confirm that the registration information is accurate.",
    );
  }

  if (!termsAccepted.value) {
    addFieldError(
      fieldErrors,
      "termsAccepted",
      "Accept the Terms and Conditions to continue.",
    );
  }

  if (!participationWaiverAccepted.value) {
    addFieldError(
      fieldErrors,
      "participationWaiverAccepted",
      "Acknowledge the Participation Waiver to continue.",
    );
  }

  if (!gymRulesAccepted.value) {
    addFieldError(
      fieldErrors,
      "gymRulesAccepted",
      "Acknowledge the facility rules to continue.",
    );
  }

  let finalEmergencyContactName = guardianFullName;
  let finalEmergencyContactRelationship = guardianRelationship.value;
  let finalEmergencyContactPhone = primaryPhone.value;

  if (usesDifferentEmergencyContact.value) {
    if (emergencyContactName.value === null) {
      addFieldError(
        fieldErrors,
        "emergencyContactName",
        "Enter the emergency contact’s full name.",
      );
    }

    if (emergencyContactRelationship.value === null) {
      addFieldError(
        fieldErrors,
        "emergencyContactRelationship",
        "Choose the emergency contact’s relationship to the player.",
      );
    }

    if (
      emergencyContactPhone.value === null ||
      !isValidPhone(emergencyContactPhone.value)
    ) {
      addFieldError(
        fieldErrors,
        "emergencyContactPhone",
        "Enter a valid emergency phone number containing 7 to 15 digits.",
      );
    }
  }

  if (hasFieldErrors(fieldErrors)) {
    return { status: "invalid", fieldErrors };
  }

  if (usesDifferentEmergencyContact.value) {
    // The error checks above guarantee these conditional values are present.
    if (
      emergencyContactName.value === null ||
      emergencyContactRelationship.value === null ||
      emergencyContactPhone.value === null
    ) {
      return { status: "invalid", fieldErrors };
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
      jerseySize: jerseySize.value,
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
