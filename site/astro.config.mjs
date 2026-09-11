import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_BASE_URL || "https://adkaku-oripa.pages.dev",
  trailingSlash: "always",
  compressHTML: true,
  build: { inlineStylesheets: "auto" },
});
