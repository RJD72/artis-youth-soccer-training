// ARTIS WAITLIST PAGE — AUGUST 22, 2026
import type { Metadata } from "next";

import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";

export const metadata: Metadata = {
  title: "Join the Waitlist",
  description: "Join the waitlist for an ARTIS Soccer Academy training group.",
};

type WaitlistPageProps = {
  searchParams: Promise<{
    group?: string | string[];
  }>;
};

const trainingGroups = {
  "ages-8-10": "Ages 8–10",
  "ages-11-13": "Ages 11–13",
} as const;

type TrainingGroupSlug = keyof typeof trainingGroups;

function isTrainingGroupSlug(value: string): value is TrainingGroupSlug {
  return value in trainingGroups;
}

const fieldClassName =
  "h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 py-3.5 text-[15px] leading-normal text-artis-navy outline-none placeholder:text-artis-slate focus:border-artis-navy focus:ring-2 focus:ring-artis-gold";

export default async function WaitlistPage({
  searchParams,
}: WaitlistPageProps) {
  const { group: groupValue } = await searchParams;
  const requestedGroup = Array.isArray(groupValue) ? groupValue[0] : groupValue;
  const selectedGroup =
    requestedGroup && isTrainingGroupSlug(requestedGroup) ? requestedGroup : "";

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto flex w-full max-w-[880px] flex-col items-start gap-5 px-6 pt-10 pb-12 xl:gap-[22px] xl:px-0 xl:py-18">
          <h1 className="w-full text-[40px] font-bold leading-[48px] tracking-[-1px] xl:text-[64px] xl:leading-[72px] xl:tracking-[-2px]">
            Join the Waitlist
          </h1>

          <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
            No payment is required while your child is on the waitlist. ARTIS
            Soccer Academy will contact you if a place becomes available.
          </p>

          <form className="flex w-full flex-col gap-4 bg-artis-soft-gold px-4 py-5 xl:gap-[18px] xl:p-8">
            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="training-group"
                className="text-[13px] font-semibold leading-normal"
              >
                Selected age group *
              </label>
              <div className="relative h-[52px] w-full">
                <select
                  id="training-group"
                  name="trainingGroup"
                  required
                  defaultValue={selectedGroup}
                  className={`${fieldClassName} appearance-none pr-12`}
                >
                  <option value="" disabled>
                    Select an age group
                  </option>
                  {Object.entries(trainingGroups).map(([slug, name]) => (
                    <option key={slug} value={slug}>
                      {name}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base font-semibold"
                >
                  ⌄
                </span>
              </div>
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="child-first-name"
                className="text-[13px] font-semibold leading-normal"
              >
                Child’s First Name *
              </label>
              <input
                id="child-first-name"
                name="childFirstName"
                type="text"
                required
                placeholder="Enter first name"
                className={fieldClassName}
              />
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="child-last-name"
                className="text-[13px] font-semibold leading-normal"
              >
                Child’s Last Name *
              </label>
              <input
                id="child-last-name"
                name="childLastName"
                type="text"
                required
                placeholder="Enter last name"
                className={fieldClassName}
              />
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="guardian-name"
                className="text-[13px] font-semibold leading-normal"
              >
                Parent or guardian name *
              </label>
              <input
                id="guardian-name"
                name="guardianName"
                type="text"
                autoComplete="name"
                required
                placeholder="Enter full name"
                className={fieldClassName}
              />
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="email"
                className="text-[13px] font-semibold leading-normal"
              >
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter email address"
                className={fieldClassName}
              />
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="phone-number"
                className="text-[13px] font-semibold leading-normal"
              >
                Phone number *
              </label>
              <input
                id="phone-number"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                required
                placeholder="Enter phone number"
                className={fieldClassName}
              />
            </div>

            <div className="flex h-20 w-full flex-col gap-2">
              <label
                htmlFor="notes"
                className="text-[13px] font-semibold leading-normal"
              >
                Relevant notes (optional)
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                placeholder="Add notes"
                className={fieldClassName}
              />
            </div>

            <button
              type="button"
              disabled
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:w-[220px]"
            >
              Join the Waitlist
            </button>
          </form>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
