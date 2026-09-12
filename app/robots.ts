import type { MetadataRoute } from "next";

const siteUrl = "https://artissocceracademy.ca";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/register/payment/",
        "/register/verify-guardian/",
        "/register/renew/verify/",
        "/register/waitlist/confirmation/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
