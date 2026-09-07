import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Gym and Facility Rules",
  description:
    "Review the school gym and facility rules for ARTIS Soccer Academy training sessions.",
};

const ruleSections = [
  {
    title: "Footwear and cleanliness",
    rules: [
      "Non-marking indoor shoes must be worn in the gym at all times.",
      "The facility must be left clean, tidy and in the same condition in which it was provided. Custodial charges may be invoiced if additional cleaning is required.",
    ],
  },
  {
    title: "Building access and security",
    rules: [
      "Schools may cancel approved permits or individual bookings when the facility is required for a school function.",
      "Community-use groups must never prop open exterior doors. School buildings remain locked for the security of the building and its occupants.",
      "When a permit holder has a keycard, someone must wait at the entrance until every member of the group has entered.",
      "When a permit holder does not have a keycard, the evening custodian will admit the first member of the group. Someone from the group must then wait at the entrance until everyone has entered.",
    ],
  },
  {
    title: "School property and displays",
    rules: [
      "Artwork, posters and other materials must not be removed from the walls during permitted use.",
      "School facilities are public school spaces. Displays, materials and other school property must not be removed, altered or interfered with.",
      "Do not place tape on gymnasium floors. Removing tape can damage the floor surface.",
    ],
  },
  {
    title: "Equipment",
    rules: [
      "Any school equipment approved for use must be returned and stored as neatly as it was found.",
      "The community-use group may be responsible for replacing equipment that is missing or damaged.",
    ],
  },
  {
    title: "Food, beverages and allergies",
    rules: [
      "Food and beverages are not permitted in the gymnasium or carpeted areas.",
      "School buildings are food-allergy conscious. Please avoid bringing foods that contain nuts.",
    ],
  },
  {
    title: "Accessibility and school questions",
    rules: [
      "For accessibility information about an individual school building, please visit that school’s website before attending.",
      "For questions relating to the school or its facilities, please contact the school directly.",
    ],
  },
];

export default function GymRulesPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main>
        <section className="bg-artis-deep-navy text-artis-white">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-8 xl:px-0 xl:py-18">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold xl:text-[13px]">
              Registration requirement
            </p>
            <h1 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              Gym and Facility Rules
            </h1>
            <p className="mt-4 max-w-[850px] text-base leading-7 text-artis-white/85 xl:text-lg xl:leading-8">
              Please review these school-use requirements before acknowledging
              the gym or facility rules on the registration form.
            </p>
          </div>
        </section>

        <section className="bg-artis-white">
          <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-16">
            <aside className="rounded-2xl border border-artis-gold bg-artis-soft-gold p-5 sm:p-6">
              <h2 className="text-xl font-bold">Before attending training</h2>
              <p className="mt-2 max-w-[820px] leading-7 text-artis-slate">
                These rules were provided for community use of the school
                facility. Players, families and other attendees should follow
                them whenever they are present at the facility.
              </p>
            </aside>

            <div className="mt-8 space-y-5">
              {ruleSections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-2xl border border-artis-border bg-artis-off-white p-5 sm:p-6"
                >
                  <h2 className="text-xl font-bold leading-7">
                    {section.title}
                  </h2>
                  <ul className="mt-4 space-y-3 pl-5 text-[15px] leading-7 text-artis-slate marker:text-artis-gold">
                    {section.rules.map((rule) => (
                      <li key={rule} className="list-disc pl-1">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-8 border-l-4 border-artis-gold bg-artis-off-white px-5 py-4">
              <p className="font-semibold leading-7">
                Thank you for helping keep the school safe, secure and ready for
                everyone who uses it.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
