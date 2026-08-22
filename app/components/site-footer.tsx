// SHARED ARTIS SITE FOOTER — AUGUST 22, 2026
import Link from "next/link";

const footerNavigation = [
  { href: "/#training", label: "Training" },
  { href: "/about", label: "About" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund-policy", label: "Refund Policy" },
];

function SocialMediaComingSoon() {
  return (
    <div
      aria-label="Facebook and Instagram links coming soon"
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 items-end justify-center rounded-full bg-artis-white text-base font-bold leading-[22px] text-artis-deep-navy"
        >
          f
        </span>
        <span>Facebook</span>
      </span>

      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-[6px] border-2 border-artis-white text-base leading-none"
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
    <div className="bg-artis-deep-navy px-8 py-8 text-artis-white">
      <p className="text-[17px] font-bold leading-[25px]">
        ARTIS SOCCER ACADEMY
      </p>

      <div className="mt-3.5 space-y-1 text-sm leading-5">
        <nav aria-label="Footer navigation">
          <p>
            <Link href="/#training">Training</Link> ·{" "}
            <Link href="/about">About</Link> · <Link href="/#faq">FAQ</Link>
          </p>
          <p>
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link> ·{" "}
            <Link href="/refund-policy">Refund Policy</Link>
          </p>
        </nav>

        <p>Contact information to be confirmed</p>

        <div className="pt-1">
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
        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-10">
          <div className="w-[500px] shrink-0">
            <p className="text-lg font-bold leading-[26px]">
              ARTIS SOCCER ACADEMY
            </p>
            <p className="mt-3 text-sm leading-5">
              Contact information to be confirmed
            </p>
          </div>

          <div className="w-[620px] text-sm font-medium leading-5">
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-3"
            >
              {footerNavigation.map((item, index) => (
                <span key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                  {index < footerNavigation.length - 1 ? " ·" : ""}
                </span>
              ))}
            </nav>

            <div className="mt-2">
              <SocialMediaComingSoon />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
