import { writeFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function seoFiles() {
  return {
    name: "tickshow-seo-files",
    apply: "build" as const,
    closeBundle() {
      const configured = (process.env.VITE_SITE_URL ?? process.env.SITE_URL ?? "").trim();
      const lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /auth/callback",
        "Disallow: /supabase/",
      ];
      let sitemap: string;
      if (configured) {
        try {
          const origin = new URL(configured).origin;
          lines.push(`Sitemap: ${new URL("/sitemap.xml", origin).toString()}`);
          sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc><changefreq>weekly</changefreq></url>\n</urlset>\n`;
        } catch {
          sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- SITE_URL is invalid; set VITE_SITE_URL before deployment. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />\n`;
        }
      } else {
        sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Set VITE_SITE_URL at build time to generate the public sitemap. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />\n`;
      }
      writeFileSync(path.resolve(__dirname, "dist", "robots.txt"), `${lines.join("\n")}\n`);
      writeFileSync(path.resolve(__dirname, "dist", "sitemap.xml"), sitemap);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), seoFiles()],
  server: {
    host: true,
    // The preview pane proxies the app through its own hostname, which Vite
    // otherwise rejects with "Blocked request. This host is not allowed."
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
