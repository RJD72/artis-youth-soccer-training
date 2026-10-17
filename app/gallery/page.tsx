import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import GalleryGrid from "./gallery-grid";
import { galleryImages } from "./gallery-images";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "See ARTIS Soccer Academy players build soccer skills through indoor training sessions in Clinton, Ontario.",
  alternates: {
    canonical: "/gallery",
  },
  openGraph: {
    title: "Gallery | ARTIS Soccer Academy",
    description:
      "Photos from ARTIS Soccer Academy training sessions in Clinton, Ontario.",
    url: "/gallery",
    images: [
      {
        url: galleryImages[0].src,
        alt: galleryImages[0].alt,
      },
    ],
  },
};

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <div className="max-w-225">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-artis-gold">
              Training in action
            </p>
            <h1 className="mt-2 text-[30px] font-bold leading-11 xl:text-[40px] xl:leading-14.5">
              ARTIS Gallery
            </h1>
            <p className="mt-5 text-base leading-6.5 text-artis-slate xl:mt-6 xl:text-lg xl:leading-7.5">
              A look inside ARTIS Soccer Academy training sessions, where
              players develop their technique, movement and confidence.
            </p>
          </div>

          <div className="mt-8 xl:mt-10">
            <GalleryGrid images={galleryImages} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
