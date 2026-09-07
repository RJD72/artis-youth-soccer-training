/** @jest-environment jsdom */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/jest-globals";
const registrationAction = jest.fn<typeof import("@/app/register/actions").submitRegistration>();
const contactAction = jest.fn<typeof import("@/app/contact/actions").submitContactMessage>();
const renewalAction = jest.fn<typeof import("@/app/register/renew/actions").requestRenewalVerification>();
const cancelAction = jest.fn<typeof import("@/app/admin/registrations/actions").cancelRegistrationAction>();
const rescheduleAction = jest.fn<typeof import("@/app/admin/registrations/actions").rescheduleRegistrationAction>();
let Program: typeof import("@/app/register/program-selector").default;
let Contact: typeof import("@/app/contact/contact-form").default;
let Renewal: typeof import("@/app/register/renew/renewal-request-form").default;
let Header: typeof import("@/app/components/site-header").default;
let Cancel: typeof import("@/app/admin/registrations/cancel-registration-control").CancelRegistrationControl;
let Reschedule: typeof import("@/app/admin/registrations/reschedule-registration-control").RescheduleRegistrationControl;
const group = { id: 1, slug: "development", displayName: "Development", minimumAge: 9, maximumAge: 12, capacity: 10, availableSpots: 2, weeklySchedule: [] };
const program = { id: 2, slug: "three-months", displayName: "Three months", durationMonths: 3, priceCents: 10000, currency: "CAD", taxBehavior: "exclusive" as const };
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(async () => {
  jest.doMock("@/app/register/actions", () => ({ submitRegistration: registrationAction })); jest.doMock("@/app/contact/actions", () => ({ submitContactMessage: contactAction })); jest.doMock("@/app/register/renew/actions", () => ({ requestRenewalVerification: renewalAction })); jest.doMock("@/app/admin/registrations/actions", () => ({ cancelRegistrationAction: cancelAction, rescheduleRegistrationAction: rescheduleAction }));
  ({ default: Program } = await import("@/app/register/program-selector")); ({ default: Contact } = await import("@/app/contact/contact-form")); ({ default: Renewal } = await import("@/app/register/renew/renewal-request-form")); ({ default: Header } = await import("@/app/components/site-header")); ({ CancelRegistrationControl: Cancel } = await import("@/app/admin/registrations/cancel-registration-control")); ({ RescheduleRegistrationControl: Reschedule } = await import("@/app/admin/registrations/reschedule-registration-control"));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
  // jsdom has no native modal/top-layer implementation. These shims exercise
  // component event/state behavior only; real focus trapping needs a browser.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
});
beforeEach(() => { jest.clearAllMocks(); registrationAction.mockReset(); contactAction.mockReset(); renewalAction.mockReset(); cancelAction.mockReset(); rescheduleAction.mockReset(); });
afterEach(() => { cleanup(); jest.restoreAllMocks(); });
afterAll(() => { for (const [prototype, name, descriptor] of [[HTMLElement.prototype, "scrollIntoView", originalScroll], [HTMLDialogElement.prototype, "showModal", originalShow], [HTMLDialogElement.prototype, "close", originalClose]] as const) { if (descriptor) Object.defineProperty(prototype, name, descriptor); else Reflect.deleteProperty(prototype, name); } });
async function submit(form: HTMLFormElement) { await act(async () => { fireEvent.submit(form); }); }
describe("registration client interactions with mocked actions", () => {
  it("displays field errors, red borders and summary, focuses first error and preserves entered values", async () => {
    registrationAction.mockResolvedValue({ status: "error", code: "invalid-form", fieldErrors: { childFirstName: "Enter the child first name.", email: "Enter a valid email." } });
    const { container } = render(<Program trainingGroups={[group]} programPackages={[program]} />);
    const firstName = screen.getByLabelText(/Child’s first name/); const email = screen.getByLabelText(/^Email address/); const lastName = screen.getByLabelText(/Child’s last name/);
    fireEvent.change(lastName, { target: { value: "Synthetic Player" } }); fireEvent.change(email, { target: { value: "invalid" } });
    await submit(container.querySelector("form")!);
    expect(screen.getByText("Please correct the highlighted fields below.")).toBeInTheDocument(); expect(firstName).toHaveAttribute("aria-invalid", "true"); expect(firstName.className).toContain("border-artis-error"); expect(firstName).toHaveFocus(); expect(lastName).toHaveValue("Synthetic Player"); expect(email).toHaveValue("invalid"); expect(email).toHaveAttribute("aria-describedby", expect.stringContaining("error"));
    fireEvent.change(firstName, { target: { value: "Test" } }); expect(firstName).not.toHaveAttribute("aria-invalid"); expect(email).toHaveAttribute("aria-invalid", "true");
  });
  it("shows guardian-verification guidance and keeps the form values", async () => { registrationAction.mockResolvedValue({ status: "error", code: "guardian-verification-required" }); const { container } = render(<Program trainingGroups={[group]} programPackages={[program]} />); const name = screen.getByLabelText(/Child’s first name/); fireEvent.change(name, { target: { value: "Test" } }); await submit(container.querySelector("form")!); expect(name).toHaveValue("Test"); expect(container.querySelector("output")?.textContent).toMatch(/email|verif/i); });
  it("does not show a checkout form without available programs", () => { const { container } = render(<Program trainingGroups={[]} programPackages={[]} />); expect(screen.getByText("Registration options are not currently available.")).toBeInTheDocument(); expect(container.querySelector("form")).toBeNull(); });
});
describe("contact and renewal request UX", () => {
  it("shows contact errors, focuses the invalid field and preserves entered text", async () => { contactAction.mockResolvedValue({ status: "error", code: "invalid-form", fieldErrors: { email: "Enter a valid email address." } }); const { container } = render(<Contact defaultEnquiry="General Enquiry" />); const name = screen.getByLabelText(/Full name/); const email = screen.getByLabelText(/^Email address/); fireEvent.change(name, { target: { value: "Test Visitor" } }); fireEvent.change(email, { target: { value: "invalid" } }); await submit(container.querySelector("form")!); expect(email).toHaveFocus(); expect(email).toHaveAttribute("aria-invalid", "true"); expect(name).toHaveValue("Test Visitor"); expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument(); });
  it("shows successful mocked contact submission and clears values", async () => { contactAction.mockResolvedValue({ status: "success" }); const { container } = render(<Contact defaultEnquiry="General Enquiry" />); const name = screen.getByLabelText(/Full name/); fireEvent.change(name, { target: { value: "Test Visitor" } }); await submit(container.querySelector("form")!); expect(screen.getByText(/Thank you. Your message has been sent/)).toBeInTheDocument(); expect(name).toHaveValue(""); expect(contactAction).toHaveBeenCalledTimes(1); });
  it("shows enumeration-resistant renewal request success", async () => { renewalAction.mockResolvedValue({ status: "submitted" }); const { container } = render(<Renewal />); await submit(container.querySelector("form")!); expect(container.querySelector("output")?.textContent).toMatch(/match|email|link/i); expect(renewalAction).toHaveBeenCalledTimes(1); });
});
describe("navigation and admin controls", () => {
  it("provides public navigation and closes mobile menu with Escape while restoring focus", () => { const { container } = render(<Header />); const nav = screen.getByRole("navigation", { name: "Primary navigation" }); expect(within(nav).getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "/contact"); const details = container.querySelector("details")!; const summary = details.querySelector("summary")!; details.open = true; fireEvent.keyDown(details, { key: "Escape" }); expect(details.open).toBe(false); expect(summary).toHaveFocus(); });
  it("closes mobile menu when selecting a link", () => { const { container } = render(<Header />); const details = container.querySelector("details")!; details.open = true; const mobile = screen.getByRole("navigation", { name: "Mobile navigation" }); mobile.addEventListener("click", event => event.preventDefault()); fireEvent.click(within(mobile).getByRole("link", { name: "About Us" })); expect(details.open).toBe(false); });
  it("opens and cancels a cancellation dialog without submitting", () => { const { container } = render(<Cancel registrationId={1} playerName="Test Player" registrationStatus="scheduled" />); fireEvent.click(screen.getByRole("button", { name: "Cancel registration" })); const dialog = container.querySelector("dialog")!; expect(dialog.open).toBe(true); expect(dialog).toHaveAccessibleName("Cancel Test Player’s registration?"); fireEvent.click(within(dialog).getByRole("button", { name: "Keep registration" })); expect(dialog.open).toBe(false); expect(cancelAction).not.toHaveBeenCalled(); });
  it("retains cancellation success with an email failure warning", async () => { cancelAction.mockResolvedValue({ status: "success", result: "cancelled", emailStatus: "failed" }); const { container } = render(<Cancel registrationId={1} playerName="Test Player" registrationStatus="active" />); fireEvent.click(screen.getByRole("button", { name: "Cancel registration" })); await submit(container.querySelector("form")!); expect(screen.getByText(/Registration cancelled, but the guardian notification email/)).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Registration cancelled" })).toBeDisabled(); expect(container.querySelector("dialog")!.open).toBe(false); });
  it("submits the selected month with a fixed registration ID and displays capacity errors", async () => { rescheduleAction.mockResolvedValue({ status: "error", code: "training-group-full" }); const { container } = render(<Reschedule registrationId={1} playerName="Test Player" currentStartsOn="2026-10-01" earliestStartMonth="2026-09" latestStartMonth="2028-09" />); fireEvent.click(screen.getByRole("button", { name: /Change start month/i })); const input = screen.getByLabelText("New starting month"); fireEvent.change(input, { target: { value: "2026-11" } }); await submit(container.querySelector("form")!); const formData = rescheduleAction.mock.calls[0][1]; expect(formData.get("registrationId")).toBe("1"); expect(formData.get("startMonth")).toBe("2026-11-01"); expect(screen.getByRole("alert")).toHaveTextContent("training group is full"); expect(container.querySelector("dialog")!.open).toBe(true); });
});
