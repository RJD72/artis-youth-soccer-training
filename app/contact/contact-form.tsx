"use client";

import { useActionState, useCallback, useState } from "react";

import { submitContactMessage, type ContactFormActionState } from "./actions";

const initialActionState: ContactFormActionState = { status: "idle" };

const fieldClassName =
  "h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 py-3.5 text-[15px] leading-5 text-artis-navy outline-none placeholder:text-artis-slate focus:border-artis-gold focus:ring-2 focus:ring-artis-gold/25 disabled:cursor-not-allowed disabled:bg-artis-off-white disabled:opacity-70";

const enquiryTypes = [
  "General Enquiry",
  "Training",
  "Registration",
  "Sponsorship",
] as const;

type ContactEnquiryType = (typeof enquiryTypes)[number];

type ContactFormProps = {
  defaultEnquiry: ContactEnquiryType;
};

type ContactFormValues = {
  fullName: string;
  email: string;
  phone: string;
  enquiryType: ContactEnquiryType;
  message: string;
};

const errorMessages = {
  "invalid-form":
    "Please check the information you entered. Your message must contain at least 10 characters.",
  "rate-limited":
    "Too many messages have been submitted. Please wait 10 minutes before trying again.",
  "unable-to-send":
    "Your message could not be sent right now. Please try again shortly.",
} as const;

function FormField({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold leading-5">
        {label}
        {required ? " *" : ""}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function getInitialValues(
  defaultEnquiry: ContactEnquiryType,
): ContactFormValues {
  return {
    fullName: "",
    email: "",
    phone: "",
    enquiryType: defaultEnquiry,
    message: "",
  };
}

export default function ContactForm({ defaultEnquiry }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>(() =>
    getInitialValues(defaultEnquiry),
  );
  const [hasEditedSinceResult, setHasEditedSinceResult] = useState(false);
  const submitAction = useCallback(
    async (
      previousState: ContactFormActionState,
      formData: FormData,
    ): Promise<ContactFormActionState> => {
      const nextState = await submitContactMessage(previousState, formData);

      if (nextState.status === "success") {
        setValues(getInitialValues(defaultEnquiry));
      }

      return nextState;
    },
    [defaultEnquiry],
  );
  const [actionState, formAction, isPending] = useActionState(
    submitAction,
    initialActionState,
  );

  function updateValue<Key extends keyof ContactFormValues>(
    field: Key,
    value: ContactFormValues[Key],
  ): void {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setHasEditedSinceResult(true);
  }

  const statusMessage = isPending
    ? "Sending your message…"
    : !hasEditedSinceResult && actionState.status === "success"
      ? "Thank you. Your message has been sent to ARTIS Soccer Academy."
      : !hasEditedSinceResult && actionState.status === "error"
        ? errorMessages[actionState.code]
        : null;
  const statusClassName =
    actionState.status === "success" && !isPending
      ? "border-artis-success text-artis-success"
      : actionState.status === "error" && !isPending
        ? "border-artis-error text-artis-error"
        : "border-artis-border text-artis-slate";

  return (
    <form
      action={formAction}
      aria-describedby={statusMessage ? "contact-form-status" : undefined}
      className="relative mt-5 space-y-4.5 bg-artis-soft-gold px-4 py-5 xl:mt-6 xl:space-y-5 xl:p-8"
      onSubmit={() => setHasEditedSinceResult(false)}
    >
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <FormField id="fullName" label="Full name" required>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
          disabled={isPending}
          value={values.fullName}
          onChange={(event) => updateValue("fullName", event.target.value)}
          placeholder="Enter full name"
          className={fieldClassName}
        />
      </FormField>

      <FormField id="email" label="Email address" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          disabled={isPending}
          value={values.email}
          onChange={(event) => updateValue("email", event.target.value)}
          placeholder="Enter email address"
          className={fieldClassName}
        />
      </FormField>

      <FormField id="phone" label="Phone number (optional)">
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          disabled={isPending}
          value={values.phone}
          onChange={(event) => updateValue("phone", event.target.value)}
          placeholder="Enter phone number"
          className={fieldClassName}
        />
      </FormField>

      <FormField id="enquiryType" label="Enquiry type" required>
        <select
          id="enquiryType"
          name="enquiryType"
          required
          disabled={isPending}
          value={values.enquiryType}
          onChange={(event) =>
            updateValue("enquiryType", event.target.value as ContactEnquiryType)
          }
          className={fieldClassName}
        >
          {enquiryTypes.map((enquiryType) => (
            <option key={enquiryType} value={enquiryType}>
              {enquiryType}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="message" label="Message" required>
        <textarea
          id="message"
          name="message"
          rows={5}
          minLength={10}
          maxLength={5_000}
          required
          disabled={isPending}
          value={values.message}
          onChange={(event) => updateValue("message", event.target.value)}
          placeholder="Enter message"
          className={`${fieldClassName} min-h-32 resize-y`}
        />
      </FormField>

      {statusMessage ? (
        <output
          id="contact-form-status"
          aria-live="polite"
          className={`block rounded-[10px] border bg-artis-white px-4 py-3 text-sm font-semibold leading-6 ${statusClassName}`}
        >
          {statusMessage}
        </output>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60 xl:w-45"
      >
        {isPending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
