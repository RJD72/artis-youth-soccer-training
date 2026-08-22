// ARTIS HOMEPAGE — FIGMA-ALIGNED POLISHED CONTENT — AUGUST 22, 2026
import Link from "next/link";

import SiteFooter from "./components/site-footer";
import SiteHeader from "./components/site-header";

const principles = [
  {
    title: "Age-appropriate development",
    description: "Training direction shaped around player age and stage.",
  },
  {
    title: "Small, focused environments",
    description: "Clear instruction with space for purposeful repetition.",
  },
  {
    title: "Skills and confidence",
    description: "A steady approach to technical growth and self-belief.",
  },
  {
    title: "Parent communication",
    description: "Straightforward information before and after registration.",
  },
];

const programs = [
  {
    age: "AGES 8–10",
    title: "Ages 8–10 Soccer Development Program",
    description:
      "A fun, positive and supportive foundation for learning the game.",
    focus: "Ball control · dribbling · passing · shooting · movement",
  },
  {
    age: "AGES 11–13",
    title: "Ages 11–13 Soccer Development Program",
    description: "Progressive skill, confidence and game understanding.",
    focus: "Ball mastery · passing · finishing · positioning · match play",
  },
];

const registrationSteps = [
  {
    number: "01",
    title: "Choose a program",
    description: "Choose an age group and payment package.",
  },
  {
    number: "02",
    title: "Share information",
    description: "Enter player and parent details.",
  },
  {
    number: "03",
    title: "Complete payment",
    description: "Review and securely submit payment.",
  },
];

const schedule = [
  {
    day: "Tuesday",
    type: "Training",
    times: ["Ages 8–10 · 6:00–7:00 PM", "Ages 11–13 · 7:00–8:00 PM"],
  },
  {
    day: "Thursday",
    type: "Training",
    times: ["Ages 8–10 · 6:00–7:00 PM", "Ages 11–13 · 7:00–8:00 PM"],
  },
  {
    day: "Saturday",
    type: "Game / Match",
    times: ["Ages 8–10 · 10:00–11:00 AM", "Ages 11–13 · 11:00 AM–12:00 PM"],
  },
];

const packages = [
  { term: "1 Month", price: "$150" },
  { term: "2 Months", price: "$299" },
  { term: "6 Months", price: "$850" },
  { term: "1 Year", price: "$1,700" },
];

const faqs = [
  {
    question: "What ages can register?",
    answer:
      "ARTIS currently offers development programs for players ages 8–10 and 11–13.",
  },
  {
    question: "What should players bring?",
    answer:
      "Final equipment and arrival instructions will be shared with parents before the first session.",
  },
  {
    question: "Where does training take place?",
    answer:
      "Training is held in the gymnasium at Central Huron Secondary School in Clinton, Ontario.",
  },
  {
    question: "What happens if a session is cancelled?",
    answer:
      "Parents will be contacted with cancellation information and any applicable scheduling update.",
  },
];

type ImagePlaceholderProps = {
  label: string;
  className?: string;
};

function ImagePlaceholder({ label, className = "" }: ImagePlaceholderProps) {
  return (
    <div
      className={`flex min-h-55 items-center justify-center rounded-2xl border-2 border-dashed border-artis-border bg-artis-soft-gold p-6 text-center ${className}`}
    >
      <div>
        <p
          aria-hidden="true"
          className="text-3xl font-semibold text-artis-gold"
        >
          ▧
        </p>
        <p className="mt-2 font-semibold text-artis-navy">{label}</p>
        <p className="mt-1 text-xs text-artis-slate">
          Approved client photograph will be added here
        </p>
      </div>
    </div>
  );
}

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white";

const registrationButton =
  "inline-flex min-h-13 items-center justify-center rounded-[10px] bg-artis-red px-6 py-4 text-center text-[15px] font-semibold leading-5 text-artis-white xl:px-8";

export default function Home() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main>
        <section className="bg-artis-deep-navy text-artis-white">
          <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-8 py-8 xl:grid-cols-[620px_520px] xl:items-center xl:gap-16 xl:px-0 xl:py-24">
            <div>
              <p className="text-xs font-semibold uppercase leading-[17px] text-artis-gold xl:text-[13px] xl:leading-[19px]">
                Year-round player development
              </p>
              <h1 className="mt-5 text-[38px] font-bold leading-[55px] xl:mt-6 xl:text-[58px] xl:leading-[84px]">
                Master the Art. Build the Skill.
              </h1>
              <div className="mt-5 text-[17px] leading-[25px] xl:mt-6 xl:max-w-[590px] xl:text-xl xl:leading-[29px]">
                <p>Develop Discipline. Grow Confidence. Love the Game.</p>
                <p className="mt-5 hidden xl:block">
                  At ARTIS Soccer Academy, soccer is both an art and a skill.
                  Players develop through creativity, repetition, discipline and
                  a commitment to getting better every day.
                </p>
              </div>
              <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center xl:mt-6">
                <Link
                  href="/register"
                  className={`${registrationButton} w-full sm:w-auto`}
                >
                  Register for Training
                </Link>
                <Link
                  href="#training"
                  className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-navy"
                >
                  Explore Programs
                </Link>
              </div>
            </div>

            <ImagePlaceholder
              label="Soccer training action photograph"
              className="h-60 xl:h-[430px]"
            />
          </div>
        </section>

        <section className="bg-artis-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8 xl:px-0 xl:py-20">
            <p className="hidden text-[13px] font-semibold uppercase leading-[19px] text-artis-gold xl:block">
              Why parents choose a clearer training experience
            </p>
            <h2 className="text-[30px] font-bold leading-[44px] xl:mt-8 xl:max-w-[900px] xl:text-[40px] xl:leading-[58px]">
              Development principles parents can understand.
            </h2>

            <div className="mt-5 grid gap-5 xl:mt-8 xl:grid-cols-4">
              {principles.map((principle) => (
                <article
                  key={principle.title}
                  className="xl:rounded-[10px] xl:border xl:border-artis-border xl:bg-artis-off-white xl:p-6"
                >
                  <h3 className="text-lg font-semibold leading-[26px] xl:text-[19px] xl:leading-7">
                    {principle.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-[22px] text-artis-slate xl:mt-3">
                    {principle.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="training" className="scroll-mt-24 bg-artis-off-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8 xl:px-0 xl:py-20">
            <h2 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              Soccer Development Programs
            </h2>
            <p className="mt-4 max-w-[850px] text-base leading-6 text-artis-slate xl:mt-8 xl:text-lg xl:leading-[26px]">
              Year-round opportunities for all experience levels, including
              beginners.
            </p>

            <div className="mt-5 grid max-w-[864px] gap-6 md:grid-cols-2 xl:mt-8">
              {programs.map((program) => (
                <article
                  key={program.age}
                  className="flex min-h-[389px] flex-col items-start rounded-2xl border border-artis-border bg-artis-white p-7"
                >
                  <p className="rounded-full bg-artis-soft-gold px-2.5 py-1.5 text-xs font-semibold">
                    {program.age}
                  </p>
                  <h3 className="mt-[18px] text-2xl font-bold leading-[35px]">
                    {program.title}
                  </h3>
                  <p className="mt-[18px] text-base leading-[23px] text-artis-slate">
                    {program.description}
                  </p>
                  <p className="mt-[18px] text-sm font-medium leading-5">
                    {program.focus}
                  </p>
                  <p className="mt-[18px] text-[13px] leading-[19px] text-artis-slate">
                    Tuesday + Thursday training · Saturday game
                  </p>
                  <Link href="/register" className={`${primaryButton} mt-auto`}>
                    View Training Details
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-artis-navy text-artis-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8 xl:px-0 xl:py-20">
            <h2 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              <span className="xl:hidden">How registration works</span>
              <span className="hidden xl:inline">
                Register in three simple steps.
              </span>
            </h2>
            <div className="mt-[18px] grid gap-[18px] xl:mt-8 xl:grid-cols-3 xl:gap-6">
              {registrationSteps.map((step) => (
                <article
                  key={step.number}
                  className="flex gap-3 xl:block xl:rounded-[10px] xl:bg-artis-deep-navy xl:p-6"
                >
                  <p className="text-[17px] font-semibold leading-[25px] text-artis-gold xl:text-[13px] xl:leading-[19px]">
                    {step.number}
                  </p>
                  <div>
                    <h3 className="text-[17px] font-semibold leading-[25px] xl:mt-2.5 xl:text-[21px] xl:leading-[30px]">
                      {step.title}
                    </h3>
                    <p className="hidden text-[15px] leading-[22px] xl:mt-2.5 xl:block">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-artis-white">
          <div className="mx-auto grid w-full max-w-[1280px] gap-5 px-8 py-8 xl:grid-cols-[520px_600px] xl:items-center xl:gap-16 xl:px-0 xl:py-20">
            <ImagePlaceholder
              label="Coach or training photograph"
              className="h-55 xl:h-[380px]"
            />
            <div>
              <p className="hidden text-[13px] font-semibold uppercase leading-[19px] text-artis-gold xl:block">
                Training philosophy
              </p>
              <h2 className="text-[30px] font-bold leading-[44px] xl:mt-[18px] xl:text-[38px] xl:leading-[55px]">
                A thoughtful approach to player development.
              </h2>
              <p className="mt-5 text-base leading-[23px] text-artis-slate xl:mt-[18px] xl:text-lg xl:leading-[26px]">
                Soccer is both an art and a skill. Players develop through
                creativity, repetition, discipline and a commitment to getting
                better every day.
              </p>
              <Link
                href="/about"
                className="mt-[18px] hidden min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 xl:inline-flex"
              >
                Learn About ARTIS
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-artis-off-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8 xl:px-0 xl:py-20">
            <h2 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              <span className="xl:hidden">Parent questions</span>
              <span className="hidden xl:inline">
                Questions parents often ask
              </span>
            </h2>
            <div className="mt-4 space-y-4 xl:mt-6 xl:space-y-6">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-lg border border-artis-border bg-artis-white"
                >
                  <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 text-base font-semibold leading-[23px] [&::-webkit-details-marker]:hidden xl:text-[17px] xl:leading-[25px]">
                    {faq.question}
                    <span
                      aria-hidden="true"
                      className="text-[22px] leading-8 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-[15px] leading-[22px] text-artis-slate">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-artis-soft-gold">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start gap-[18px] px-8 py-8 xl:items-center xl:gap-6 xl:px-0 xl:py-20 xl:text-center">
            <h2 className="max-w-[850px] text-[30px] font-bold leading-[44px] xl:text-[38px] xl:leading-[55px]">
              Ready to explore training with ARTIS?
            </h2>
            <p className="hidden max-w-[800px] text-lg leading-[26px] text-artis-slate xl:block">
              Register your interest and review the available program details.
            </p>
            <Link
              href="/register"
              className={`${registrationButton} w-full sm:w-auto`}
            >
              Register for Training
            </Link>
          </div>
        </section>

        <section id="schedule" className="scroll-mt-24 bg-artis-off-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-12 xl:px-0 xl:py-20">
            <div className="max-w-[820px]">
              <p className="text-xs font-semibold uppercase leading-[17px] text-artis-gold xl:text-[13px] xl:leading-[19px]">
                Training schedule
              </p>
              <h2 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
                Year-Round Training
              </h2>
              <p className="mt-4 text-base leading-6 text-artis-slate xl:text-lg xl:leading-[26px]">
                Two focused training sessions and one game or match each week.
              </p>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_420px] xl:items-stretch">
              <div className="grid gap-4 md:grid-cols-3">
                {schedule.map((session) => (
                  <article
                    key={session.day}
                    className="rounded-2xl border border-artis-border bg-artis-white p-6"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                      {session.type}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold">{session.day}</h3>
                    <div className="mt-5 space-y-2 text-[15px] leading-[22px] text-artis-slate">
                      {session.times.map((time) => (
                        <p key={time}>{time}</p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <ImagePlaceholder
                label="Saturday game or training photograph"
                className="h-full min-h-70"
              />
            </div>

            <p className="mt-5 text-sm leading-5 text-artis-slate">
              School gym schedule is subject to final confirmation.
            </p>
          </div>
        </section>

        <section className="bg-artis-white">
          <div className="mx-auto w-full max-w-[1280px] px-8 py-12 xl:px-0 xl:py-20">
            <div className="max-w-[820px]">
              <p className="text-xs font-semibold uppercase leading-[17px] text-artis-gold xl:text-[13px] xl:leading-[19px]">
                Flexible commitments
              </p>
              <h2 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
                Training Packages
              </h2>
              <p className="mt-4 text-base leading-6 text-artis-slate xl:text-lg xl:leading-[26px]">
                Choose the fixed program period that works for your family.
                Packages are prepaid and do not automatically renew.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {packages.map((programPackage) => (
                <article
                  key={programPackage.term}
                  className="rounded-2xl border border-artis-border bg-artis-off-white p-6"
                >
                  <h3 className="text-lg font-semibold">
                    {programPackage.term}
                  </h3>
                  <p className="mt-3 text-3xl font-bold">
                    {programPackage.price}
                    <span className="ml-1 text-sm font-medium text-artis-slate">
                      + HST
                    </span>
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-6 rounded-2xl bg-artis-soft-gold p-6 xl:grid-cols-[1fr_360px] xl:items-center xl:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                  Academy jersey
                </p>
                <h3 className="mt-3 text-2xl font-bold">
                  One personalized jersey per player, per year
                </h3>
                <p className="mt-3 max-w-2xl text-[15px] leading-[22px] text-artis-slate">
                  Returning players who have already received their jersey
                  should continue using their existing one.
                </p>
              </div>
              <ImagePlaceholder
                label="Personalized academy jersey photograph"
                className="min-h-45 bg-artis-white/60"
              />
            </div>

            <p className="mt-5 text-sm leading-5 text-artis-slate">
              Fixed program periods begin on the first day of the month and end
              on the final day of the applicable month.
            </p>
          </div>
        </section>

        <section className="bg-artis-off-white">
          <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-8 py-12 xl:grid-cols-[1fr_520px] xl:items-center xl:gap-16 xl:px-0 xl:py-20">
            <div>
              <p className="text-xs font-semibold uppercase leading-[17px] text-artis-gold xl:text-[13px] xl:leading-[19px]">
                Training location
              </p>
              <h2 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
                Central Huron Secondary School
              </h2>
              <address className="mt-5 not-italic text-lg leading-[30px]">
                <p>165 Princess Street East</p>
                <p>Clinton, Ontario</p>
                <p>N0M 1L0</p>
              </address>
              <p className="mt-5 max-w-xl text-base leading-6 text-artis-slate xl:text-lg xl:leading-[26px]">
                Training is held in the school gymnasium, convenient for
                Clinton, Goderich, Seaforth and surrounding communities.
              </p>
            </div>

            <ImagePlaceholder
              label="Central Huron Secondary School gymnasium photograph"
              className="h-70 xl:h-[360px]"
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
