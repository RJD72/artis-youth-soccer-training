import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the ARTIS Soccer Academy Privacy Policy and learn how personal information is collected, used and protected.",
};

const informationCollected = [
  "Player name, preferred name, and date of birth",
  "Jersey size",
  "Current playing level, team, or club information",
  "Medical, health, safety, or training information voluntarily provided for the player",
  "Coach information provided as part of registration",
  "Parent or guardian name and relationship to the player",
  "Email address and telephone numbers",
  "Preferred contact method",
  "Emergency contact information",
  "Program, training group, and registration information",
  "Payment method, payment status, transaction references, and related payment information",
  "Optional marketing preferences",
  "Optional photo and video consent",
  "Messages or information submitted through our contact forms",
];

const informationUses = [
  "Process and manage registrations and renewals",
  "Confirm player eligibility for an age group or program",
  "Manage program capacity and waitlists",
  "Schedule and administer training programs",
  "Communicate with parents and guardians",
  "Contact emergency contacts where reasonably necessary",
  "Provide coaches with information reasonably required for player safety and training",
  "Process and confirm payments",
  "Maintain registration and payment records",
  "Send verification, registration, renewal, and payment-related emails",
  "Respond to questions and contact requests",
  "Maintain accurate administrative records",
  "Comply with legal, accounting, safety, and regulatory requirements",
  "Send marketing communications where consent has been provided",
  "Use photographs or video where the appropriate consent has been provided",
];

const serviceProviders = [
  {
    name: "Stripe",
    purpose: "payment processing",
  },
  {
    name: "Hostinger",
    purpose: "website hosting and database infrastructure",
  },
  {
    name: "Resend",
    purpose: "transactional email delivery",
  },
];

const retentionPurposes = [
  "Administer registrations and programs",
  "Maintain appropriate business and payment records",
  "Meet legal, accounting, or regulatory obligations",
  "Resolve disputes or address complaints",
  "Fulfil the purposes for which the information was collected",
];

function PolicySection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-artis-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold leading-8 text-artis-navy sm:text-2xl">
        {number}. {title}
      </h2>

      <div className="mt-4 space-y-4 text-[15px] leading-7 text-artis-slate sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main>
        <section className="bg-artis-deep-navy text-artis-white">
          <div className="mx-auto w-full max-w-7xl px-6 py-10 xl:px-0 xl:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold xl:text-[13px]">
              ARTIS Soccer Academy
            </p>

            <h1 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              Privacy Policy
            </h1>

            <p className="mt-4 max-w-[850px] text-base leading-7 text-artis-white/85 xl:text-lg xl:leading-8">
              This policy explains how ARTIS Soccer Academy collects, uses,
              protects, and manages personal information.
            </p>

            <p className="mt-4 text-sm font-semibold text-artis-white/75">
              Effective date: September 12, 2026
            </p>
          </div>
        </section>

        <section className="bg-artis-white">
          <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-14">
            <div className="rounded-2xl border border-artis-border bg-artis-off-white p-6 sm:p-8">
              <p className="text-[15px] leading-7 text-artis-slate sm:text-base">
                ARTIS Soccer Academy respects the privacy of players, parents,
                guardians, and visitors to our website. This Privacy Policy
                explains what personal information we collect, why we collect
                it, how it is used and protected, and the choices available to
                you.
              </p>
            </div>

            <div className="mt-10 space-y-10">
              <PolicySection number={1} title="Information We Collect">
                <p>
                  When a parent or guardian registers a player, joins a
                  waitlist, renews a registration, contacts us, or otherwise
                  uses our website, we may collect information such as:
                </p>

                <ul className="space-y-2 pl-5 marker:text-artis-gold">
                  {informationCollected.map((item) => (
                    <li key={item} className="list-disc pl-1">
                      {item}
                    </li>
                  ))}
                </ul>

                <p>
                  Parents and guardians should provide only information that is
                  reasonably necessary for the player&apos;s participation in
                  ARTIS Soccer Academy programs.
                </p>
              </PolicySection>

              <PolicySection number={2} title="Information About Children">
                <p>
                  ARTIS Soccer Academy programs are intended for youth players.
                  Personal information about a child should be submitted only by
                  a parent, legal guardian, or another person authorized to
                  register the child.
                </p>

                <p>
                  We use information about youth players only for purposes
                  connected with their registration, participation, safety,
                  training, communication, and administration of ARTIS Soccer
                  Academy programs, unless otherwise permitted or required by
                  law.
                </p>
              </PolicySection>

              <PolicySection number={3} title="How We Use Personal Information">
                <p>We may use personal information to:</p>

                <ul className="space-y-2 pl-5 marker:text-artis-gold">
                  {informationUses.map((item) => (
                    <li key={item} className="list-disc pl-1">
                      {item}
                    </li>
                  ))}
                </ul>

                <p>
                  We do not use personal information for unrelated purposes
                  without obtaining appropriate consent, unless permitted or
                  required by law.
                </p>
              </PolicySection>

              <PolicySection number={4} title="Payments">
                <p>
                  Credit and debit card payments are processed through Stripe.
                  Payment card details are entered into Stripe&apos;s payment
                  system and are not intended to be stored directly in the ARTIS
                  Soccer Academy website database.
                </p>

                <p>
                  ARTIS Soccer Academy may retain information associated with a
                  payment, such as the amount, payment status, transaction
                  reference, payment method, and registration associated with
                  the payment.
                </p>

                <p>
                  When payment is made by e-transfer, ARTIS Soccer Academy may
                  retain the registration reference, payment status, and
                  information reasonably necessary to confirm and reconcile the
                  payment.
                </p>
              </PolicySection>

              <PolicySection number={5} title="Service Providers">
                <p>
                  ARTIS Soccer Academy uses third-party service providers to
                  operate the website and deliver its services. These may
                  include:
                </p>

                <ul className="space-y-2 pl-5 marker:text-artis-gold">
                  {serviceProviders.map((provider) => (
                    <li key={provider.name} className="list-disc pl-1">
                      <strong className="text-artis-navy">
                        {provider.name}
                      </strong>{" "}
                      for {provider.purpose}
                    </li>
                  ))}
                </ul>

                <p>
                  These providers may process personal information on behalf of
                  ARTIS Soccer Academy where necessary to provide their
                  services.
                </p>

                <p>
                  Some service providers may process or store information
                  outside Canada. Where this occurs, information may be subject
                  to the laws of the jurisdiction in which it is processed or
                  stored.
                </p>
              </PolicySection>

              <PolicySection number={6} title="Consent">
                <p>
                  By submitting personal information through the ARTIS Soccer
                  Academy website, you consent to its collection, use, and
                  disclosure for the purposes described in this Privacy Policy
                  and at the time the information is collected.
                </p>

                <p>
                  Certain choices, including marketing communications and photo
                  or video use, are optional and are handled separately from the
                  information required to register and administer a player.
                </p>

                <p>
                  Consent may be withdrawn for optional uses by contacting ARTIS
                  Soccer Academy. Withdrawal of consent does not affect uses or
                  disclosures that occurred before consent was withdrawn and may
                  be subject to legal or contractual limitations.
                </p>
              </PolicySection>

              <PolicySection
                number={7}
                title="How We Protect Personal Information"
              >
                <p>
                  ARTIS Soccer Academy uses administrative and technical
                  safeguards appropriate to the sensitivity of the information
                  being handled.
                </p>

                <p>
                  Access to registration and administrative information is
                  limited to authorized individuals who require it for
                  legitimate academy purposes. Sensitive information is handled
                  with additional safeguards appropriate to its nature.
                </p>

                <p>
                  No electronic system can be guaranteed to be completely
                  secure, but ARTIS Soccer Academy takes reasonable measures to
                  protect personal information against unauthorized access,
                  disclosure, alteration, loss, or misuse.
                </p>
              </PolicySection>

              <PolicySection number={8} title="Retention of Information">
                <p>
                  ARTIS Soccer Academy retains personal information only for as
                  long as reasonably necessary to:
                </p>

                <ul className="space-y-2 pl-5 marker:text-artis-gold">
                  {retentionPurposes.map((item) => (
                    <li key={item} className="list-disc pl-1">
                      {item}
                    </li>
                  ))}
                </ul>

                <p>
                  When personal information is no longer reasonably required,
                  ARTIS Soccer Academy may securely delete, destroy, or
                  anonymize it, subject to applicable legal requirements.
                </p>
              </PolicySection>

              <PolicySection number={9} title="Accuracy and Corrections">
                <p>
                  Parents and guardians are responsible for providing accurate
                  and current information.
                </p>

                <p>
                  If your contact information, emergency contact information, or
                  other registration information changes, please contact ARTIS
                  Soccer Academy so that the information can be corrected where
                  appropriate.
                </p>
              </PolicySection>

              <PolicySection number={10} title="Access to Personal Information">
                <p>
                  You may request access to personal information that ARTIS
                  Soccer Academy holds about you or your child and may request
                  corrections where information is inaccurate or incomplete.
                </p>

                <p>
                  ARTIS Soccer Academy may need to verify your identity and your
                  authority to access information concerning a child before
                  responding to a request.
                </p>

                <p>Access may be limited where permitted or required by law.</p>
              </PolicySection>

              <PolicySection number={11} title="Marketing Communications">
                <p>
                  ARTIS Soccer Academy will use personal information for
                  optional marketing communications only where the appropriate
                  consent has been provided.
                </p>

                <p>
                  You may withdraw marketing consent by contacting ARTIS Soccer
                  Academy or using an unsubscribe mechanism where one is
                  provided.
                </p>
              </PolicySection>

              <PolicySection number={12} title="Photos and Videos">
                <p>
                  Where photo or video consent has been provided, ARTIS Soccer
                  Academy may use photographs or recordings in connection with
                  academy activities, communications, promotional material,
                  instructional material, social media, or other academy-related
                  purposes.
                </p>

                <p>
                  Photo and video consent is handled separately from the
                  personal information required to register a player.
                </p>
              </PolicySection>

              <PolicySection
                number={13}
                title="Disclosure Required by Law or for Safety"
              >
                <p>
                  ARTIS Soccer Academy may disclose personal information where
                  reasonably necessary to protect the safety of a player or
                  another person, respond to an emergency, comply with a legal
                  obligation, or where otherwise permitted or required by law.
                </p>
              </PolicySection>

              <PolicySection number={14} title="Changes to This Privacy Policy">
                <p>
                  ARTIS Soccer Academy may update this Privacy Policy as its
                  programs, website, service providers, or privacy practices
                  change.
                </p>

                <p>
                  The current version will be made available on the ARTIS Soccer
                  Academy website, together with its effective date.
                </p>

                <p>
                  If a change materially affects how previously collected
                  personal information will be used, ARTIS Soccer Academy will
                  obtain additional consent where required.
                </p>
              </PolicySection>

              <PolicySection number={15} title="Contact ARTIS Soccer Academy">
                <p>
                  Questions, requests for access or correction, withdrawal of
                  optional consent, or privacy concerns can be directed to:
                </p>

                <div className="border-l-4 border-artis-gold bg-artis-soft-gold px-5 py-4">
                  <p className="font-bold text-artis-navy">
                    ARTIS Soccer Academy
                  </p>
                  <p>Privacy Contact</p>
                  <p>
                    Email:{" "}
                    <a
                      href="mailto:artissocceracademy@gmail.com"
                      className="font-semibold text-artis-navy underline"
                    >
                      artissocceracademy@gmail.com
                    </a>
                  </p>
                </div>

                <p>
                  ARTIS Soccer Academy will review privacy questions and
                  concerns and respond as appropriate.
                </p>
              </PolicySection>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
