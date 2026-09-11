import { defineConfig } from "astro/config";
export default defineConfig({ site: process.env.SITE_BASE_URL || "https://example.pages.dev", trailingSlash: "always" });
