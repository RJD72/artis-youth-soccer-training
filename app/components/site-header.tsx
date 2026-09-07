// SHARED ARTIS SITE HEADER — AUGUST 22, 2026
"use client";

import Image from "next/image";
import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";

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

function closeMobileMenu(event: MouseEvent<HTMLAnchorElement>): void {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

function closeMobileMenuOnEscape(
  event: KeyboardEvent<HTMLDetailsElement>,
): void {
  if (event.key !== "Escape") {
    return;
  }

  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary")?.focus();
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-artis-white">
      <div className="mx-auto flex h-21 w-full max-w-7xl items-center px-5 xl:h-28 xl:gap-10 xl:px-0">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-artis-gold"
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
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm transition-colors hover:text-artis-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-artis-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/register"
          className="ml-auto hidden min-h-12 shrink-0 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white transition-colors hover:bg-artis-deep-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold xl:inline-flex"
        >
          Register for Training
        </Link>

        <details
          className="group static ml-auto xl:hidden"
          onKeyDown={closeMobileMenuOnEscape}
        >
          <summary className="inline-flex min-h-12 w-16 cursor-pointer list-none items-center justify-end rounded-md text-right text-[13px] font-semibold leading-4.75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">MENU</span>
            <span className="hidden group-open:inline">CLOSE</span>
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
                  onClick={closeMobileMenu}
                  className="flex min-h-15 items-center rounded-md text-xl font-semibold leading-7.5 transition-colors hover:text-artis-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/register"
                onClick={closeMobileMenu}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white transition-colors hover:bg-artis-deep-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold"
              >
                Register for Training
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
