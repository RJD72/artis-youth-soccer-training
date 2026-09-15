// SHARED ARTIS SITE FOOTER — AUGUST 22, 2026
import Link from "next/link";

const footerNavigation = [
  { href: "/#training", label: "Training" },
  { href: "/about", label: "About" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
];

type SocialMediaComingSoonProps = {
  align?: "start" | "end";
};

function SocialMediaComingSoon({
  align = "start",
}: Readonly<SocialMediaComingSoonProps>) {
  return (
    <div
      aria-label="Facebook and Instagram links coming soon"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${
        align === "end" ? "justify-end" : "justify-start"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 items-end justify-center rounded-full bg-artis-white text-base font-bold leading-5.5 text-artis-deep-navy"
        >
          f
        </span>
        <span>Facebook</span>
      </span>

      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-md border-2 border-artis-white text-base leading-none"
        >
          ◎
        </span>
        <span>Instagram</span>
      </span>

      <span className="text-artis-white/70">(Coming soon)</span>
    </div>
  );
}

export function MobileFooterContent() {
  return (
    <div className="bg-artis-deep-navy px-6 py-8 text-artis-white sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <p className="text-[17px] font-bold leading-6.25">
          ARTIS SOCCER ACADEMY
        </p>

        <nav
          aria-label="Footer navigation"
          className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium leading-5"
        >
          {footerNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="mt-5 text-sm leading-5 text-artis-white/80">
          Central Huron Secondary School
          <br />
          165 Princess St E, Clinton, ON N0M 1L0
        </p>

        <div className="mt-3 text-sm leading-5">
          <SocialMediaComingSoon />
        </div>
      </div>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer>
      <div className="xl:hidden">
        <MobileFooterContent />
      </div>

      <div className="hidden bg-artis-deep-navy px-10 py-12 text-artis-white xl:block">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-start gap-16">
          <div>
            <p className="text-lg font-bold leading-6.5">
              ARTIS SOCCER ACADEMY
            </p>
            <p className="mt-3 text-sm leading-5 text-artis-white/80">
              Central Huron Secondary School
              <br />
              165 Princess St E, Clinton, ON N0M 1L0
            </p>
          </div>

          <div className="ml-auto flex max-w-155 flex-col items-end text-right text-sm font-medium leading-5">
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap justify-end gap-x-4 gap-y-2"
            >
              {footerNavigation.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-3">
              <SocialMediaComingSoon align="end" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
