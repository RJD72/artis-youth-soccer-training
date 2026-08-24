import type { Metadata } from "next";

import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";

import RenewalRequestForm from "./renewal-request-form";

export const metadata: Metadata = {
  title: "Renew Training",
  description:
    "Request a secure renewal link for an existing ARTIS Soccer Academy player.",
};

const renewalSteps = [
  {
    title: "Confirm the player",
    description:
      "Enter the guardian email, player name and birth date from the original registration.",
  },
  {
    title: "Open the secure link",
    description:
      "If the information matches, the guardian will receive an email link that expires after 30 minutes.",
  },
  {
    title: "Choose the next package",
    description:
      "Review the current training period, select the next package and complete payment.",
  },
] as const;

export default function RenewalRequestPage() {
  return (
    <div className="flex min-h-screen flex-col bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="flex-1">
        <section
          aria-label="Training renewal request"
          className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-10 xl:grid-cols-[minmax(0,720px)_minmax(320px,480px)] xl:items-start xl:gap-16 xl:px-0 xl:py-20"
        >
          <RenewalRequestForm />

          <aside className="rounded-[12px] border border-artis-border bg-artis-white p-6 xl:p-7">
            <h2 className="text-2xl font-bold leading-[35px]">
              What happens next
            </h2>

            <ol className="mt-[18px] space-y-[18px]">
              {renewalSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center rounded-full bg-artis-navy text-[13px] font-bold leading-none text-artis-white"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold leading-[23px]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-artis-slate">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 border-t border-artis-border pt-5">
              <p className="text-sm font-semibold leading-5">
                Renewing early will not shorten the current package.
              </p>
              <p className="mt-2 text-sm leading-5 text-artis-slate">
                The next paid training period will begin after the player’s
                latest scheduled period ends.
              </p>
            </div>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
