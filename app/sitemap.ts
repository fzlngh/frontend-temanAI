import type { MetadataRoute } from "next";

const siteUrl = "https://temanai-five.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
    },
  ];
}
