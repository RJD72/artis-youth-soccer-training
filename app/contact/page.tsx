import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact ARTIS Soccer Academy about training, registration or sponsorship.",
};

type ContactPageProps = {
  searchParams: Promise<{
    topic?: string | string[];
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const parameters = await searchParams;
  const requestedTopic = Array.isArray(parameters.topic)
    ? parameters.topic[0]
    : parameters.topic;
  const defaultEnquiry =
    requestedTopic?.toLowerCase() === "sponsorship"
      ? "Sponsorship"
      : "General Enquiry";

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-[1280px] px-8 py-8 xl:px-0 xl:py-20">
          <div className="w-full max-w-[900px]">
            <h1 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
              Contact Us
            </h1>

            <p className="mt-3 text-base leading-[26px] text-artis-slate xl:mt-4 xl:text-lg xl:leading-[30px]">
              Have a question about training, registration or sponsorship? Send
              ARTIS Soccer Academy a message and the academy will reply as soon
              as possible.
            </p>

            <ContactForm defaultEnquiry={defaultEnquiry} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
