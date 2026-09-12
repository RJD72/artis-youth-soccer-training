import { validateRegistrationSubmission } from "@/lib/registration-form-validation";
export const formFields: Record<string, string> = {
  trainingGroupId: "1",
  programPackageId: "2",
  childFirstName: "Test",
  childLastName: "Player",
  dateOfBirth: "2015-06-15",
  preferredName: "Tester",
  jerseySize: "medium",
  currentPlayingLevel: "beginner",
  medicalInformation: "Synthetic medical note",
  coachInformation: "Synthetic coach note",
  guardianFirstName: "Test",
  guardianLastName: "Guardian",
  guardianRelationship: "Parent",
  email: "guardian@example.com",
  primaryPhone: "519-555-0123",
  preferredContactMethod: "email",
  authorizedRegistrantConfirmed: "on",
  informationAccuracyConfirmed: "on",
  termsAccepted: "on",
  participationWaiverAccepted: "on",
  gymRulesAccepted: "on",
  cancellationPolicyAccepted: "on",
  paymentMethod: "stripe",
};
export function registrationForm(changes: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({ ...formFields, ...changes }).forEach(([key, value]) =>
    form.set(key, value),
  );
  return form;
}
export function submission() {
  const result = validateRegistrationSubmission(registrationForm());
  if (result.status !== "valid") throw new Error("Invalid test fixture");
  return result.data;
}
export const group = {
  id: 1,
  slug: "development",
  minimumAge: 9,
  maximumAge: 12,
  capacity: 2,
  registrationOpen: true,
};
export const program = {
  id: 2,
  durationMonths: 3,
  priceCents: 10000,
  currency: "CAD",
  taxBehavior: "exclusive",
};
export const guardian = {
  id: 3,
  fullName: "Test Guardian",
  phone: "5195550123",
  secondaryPhone: null,
  preferredContactMethod: "email",
};
export const legal = [
  "terms_conditions",
  "participation_waiver",
  "gym_facility_rules",
  "cancellation_refund_policy",
].map((documentType, index) => ({ id: index + 1, documentType }));
