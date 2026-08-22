// SHARED ARTIS SITE HEADER — AUGUST 22, 2026
import Image from "next/image";
import Link from "next/link";

const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/#training", label: "Training" },
  { href: "/#schedule", label: "Schedule" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About Us" },
  { href: "/coaches", label: "Coaches" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact Us" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0  z-50 bg-artis-white">
      <div className="mx-auto flex h-21 w-full max-w-7xl items-center px-5 xl:h-28 xl:gap-10 xl:px-0">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="ARTIS Soccer Academy home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={64}
            height={64}
            className="size-13 object-contain xl:size-16"
            priority
          />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 whitespace-nowrap text-[15px] font-semibold leading-5.5 xl:flex"
        >
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/register"
          className="ml-auto hidden min-h-12 shrink-0 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:inline-flex"
        >
          Register for Training
        </Link>

        <details className="group static ml-auto xl:hidden">
          <summary className="w-14 cursor-pointer list-none text-right text-[13px] font-semibold leading-4.75 [&::-webkit-details-marker]:hidden">
            MENU
          </summary>
          <div className="absolute inset-x-0 top-full z-50 shadow-[0_18px_30px_rgba(6,21,34,0.16)]">
            <nav
              aria-label="Mobile navigation"
              className="bg-artis-white px-6 pt-6 pb-10"
            >
              {primaryNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-15 items-center text-xl font-semibold leading-7.5"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
