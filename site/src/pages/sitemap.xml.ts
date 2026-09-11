import type { APIRoute } from "astro";
import { all } from "../lib/oripa";

// astro-sitemap を入れずに静的生成（依存を増やさない）
export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL("https://adkaku-oripa.pages.dev/")).href.replace(/\/$/, "");
  const staticPaths = ["/", "/about/", "/disclaimer/"];
  const entries = [
    ...staticPaths.map((p) => ({ loc: `${base}${p}`, lastmod: "" })),
    ...all.map((d) => ({ loc: `${base}${d.path}`, lastmod: d.checkedAt })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
