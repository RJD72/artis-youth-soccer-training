// ARTIS CONTACT PAGE — UI PREVIEW — AUGUST 22, 2026
import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact ARTIS Soccer Academy about training, registration or sponsorship.",
};

type ContactPageProps = {
  searchParams: Promise<{
    topic?: string | string[];
  }>;
};

const fieldClassName =
  "h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 py-3.5 text-[15px] leading-5 text-artis-navy outline-none placeholder:text-artis-slate focus:border-artis-gold focus:ring-2 focus:ring-artis-gold/25";

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
      <label htmlFor={id} className="text-[13px] font-semibold leading-5">
        {label}
        {required ? " *" : ""}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const parameters = await searchParams;
  const requestedTopic = Array.isArray(parameters.topic)
    ? parameters.topic[0]
    : parameters.topic;
  const defaultEnquiry =
    requestedTopic?.toLowerCase() === "sponsorship"
      ? "Sponsorship"
      : "General Enquiry";

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-[880px] px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <h1 className="text-[40px] font-bold leading-12 tracking-[-1px] xl:text-[64px] xl:leading-18 xl:tracking-[-2px]">
            Contact Us
          </h1>

          <p className="mt-5 text-base leading-[26px] text-artis-slate xl:mt-6 xl:text-lg xl:leading-[30px]">
            Contact form delivery will be enabled after the academy’s final
            email details are confirmed.
          </p>

          <form
            aria-describedby="contact-form-status"
            className="mt-5 space-y-[18px] bg-artis-soft-gold px-4 py-5 xl:mt-6 xl:space-y-5 xl:p-8"
          >
            <FormField id="fullName" label="Full name" required>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Enter full name"
                className={fieldClassName}
                required
              />
            </FormField>

            <FormField id="email" label="Email address" required>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter email address"
                className={fieldClassName}
                required
              />
            </FormField>

            <FormField id="phone" label="Phone number (optional)">
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="Enter phone number"
                className={fieldClassName}
              />
            </FormField>

            <FormField id="enquiryType" label="Enquiry type" required>
              <select
                id="enquiryType"
                name="enquiryType"
                defaultValue={defaultEnquiry}
                className={fieldClassName}
                required
              >
                <option>General Enquiry</option>
                <option>Training</option>
                <option>Registration</option>
                <option>Sponsorship</option>
              </select>
            </FormField>

            <FormField id="message" label="Message" required>
              <textarea
                id="message"
                name="message"
                rows={5}
                placeholder="Enter message"
                className={`${fieldClassName} min-h-[52px] resize-y`}
                required
              />
            </FormField>

            <p
              id="contact-form-status"
              className="text-sm font-semibold leading-5 text-artis-slate"
            >
              Message delivery is not connected yet. The form is currently a
              visual preview.
            </p>

            <button
              type="button"
              disabled
              className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white opacity-60 xl:w-[180px]"
            >
              Send Message
            </button>
          </form>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
