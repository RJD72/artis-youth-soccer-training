// SHARED ARTIS SITE HEADER — SEPTEMBER 7, 2026
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

type NavigationItem = {
  href: string;
  label: string;
  sectionId?: string;
};

const primaryNavigation: NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/#training", label: "Training", sectionId: "training" },
  { href: "/#schedule", label: "Schedule", sectionId: "schedule" },
  { href: "/about", label: "About Us" },
  { href: "/coaches", label: "Coaches" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/#faq", label: "FAQ", sectionId: "faq" },
  { href: "/contact", label: "Contact Us" },
];

const homeSectionIds = primaryNavigation.flatMap((item) =>
  item.sectionId ? [item.sectionId] : [],
);

function closeMobileMenu(event: MouseEvent<HTMLAnchorElement>): void {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

function scrollHomeToTop(event: MouseEvent<HTMLAnchorElement>): void {
  if (window.location.pathname !== "/") {
    return;
  }

  event.preventDefault();

  if (window.location.hash) {
    window.history.replaceState(null, "", "/");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
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

function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
  activeSection: string | null,
): boolean {
  if (item.sectionId) {
    return pathname === "/" && activeSection === item.sectionId;
  }

  if (item.href === "/") {
    return pathname === "/" && activeSection === null;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    let animationFrameId: number | null = null;

    function updateActiveSection(): void {
      animationFrameId = null;

      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const markerPosition = headerHeight + 24;

      const sections = homeSectionIds
        .map((sectionId) => document.getElementById(sectionId))
        .filter((section): section is HTMLElement => section !== null)
        .map((section) => ({
          id: section.id,
          top: section.getBoundingClientRect().top,
        }))
        .filter((section) => section.top <= markerPosition)
        .sort((a, b) => b.top - a.top);

      const nextActiveSection = sections[0]?.id ?? null;

      setActiveSection((currentActiveSection) =>
        currentActiveSection === nextActiveSection
          ? currentActiveSection
          : nextActiveSection,
      );
    }

    function scheduleActiveSectionUpdate(): void {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    }

    scheduleActiveSectionUpdate();

    window.addEventListener("scroll", scheduleActiveSectionUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleActiveSectionUpdate);
    window.addEventListener("hashchange", scheduleActiveSectionUpdate);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener("scroll", scheduleActiveSectionUpdate);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
      window.removeEventListener("hashchange", scheduleActiveSectionUpdate);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-artis-white">
      <div className="mx-auto flex h-21 w-full max-w-7xl items-center px-5 xl:h-28 xl:gap-10 xl:px-0">
        <Link
          href="/"
          onClick={scrollHomeToTop}
          className="flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-artis-gold"
          aria-label="ARTIS Soccer Academy home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={80}
            className="size-16 object-contain xl:size-20"
            priority
          />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 whitespace-nowrap text-[15px] font-semibold leading-5.5 xl:flex"
        >
          {primaryNavigation.map((item) => {
            const isActive = isNavigationItemActive(
              item,
              pathname,
              activeSection,
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={scrollHomeToTop}
                aria-current={
                  isActive ? (item.sectionId ? "location" : "page") : undefined
                }
                className={`rounded-sm transition-colors hover:text-artis-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-artis-gold ${
                  isActive
                    ? "underline decoration-artis-gold decoration-[3px] underline-offset-8"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
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

          <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-5.25rem)] overflow-y-auto shadow-[0_18px_30px_rgba(6,21,34,0.16)]">
            <nav
              aria-label="Mobile navigation"
              className="bg-artis-white px-6 pt-6 pb-10"
            >
              {primaryNavigation.map((item) => {
                const isActive = isNavigationItemActive(
                  item,
                  pathname,
                  activeSection,
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => {
                      if (item.href === "/") {
                        scrollHomeToTop(event);
                      }

                      closeMobileMenu(event);
                    }}
                    aria-current={
                      isActive
                        ? item.sectionId
                          ? "location"
                          : "page"
                        : undefined
                    }
                    className={`flex min-h-15 items-center rounded-md text-xl font-semibold leading-7.5 transition-colors hover:text-artis-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold ${
                      isActive
                        ? "underline decoration-artis-gold decoration-[3px] underline-offset-8"
                        : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

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
