import type { MetadataRoute } from "next";

const siteUrl = "https://artissocceracademy.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/about",
    "/coaches",
    "/sponsors",
    "/contact",
    "/register",
    "/privacy",
    "/waiver",
    "/gym-rules",
    "/cancellation-policy",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/register" ? 0.9 : 0.7,
  }));
}
