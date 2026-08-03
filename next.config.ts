import type { NextConfig } from "next";

// CSP scopée aux domaines externes réellement appelés par l'app :
//  - tile.openstreetmap.org : fond de carte (MapLibre GL, fetch + <img> selon le renderer)
//  - api.open-meteo.com / archive-api.open-meteo.com : prévisions et climatologie
//  - overpass-api.de : recherche de POI (boulangeries, points d'eau...)
// script-src/style-src gardent 'unsafe-inline' (Next.js et MapLibre GL injectent des
// styles/scripts inline) ; un CSP strict à base de nonce demanderait une refonte plus
// large, hors scope de ce correctif.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "connect-src 'self' https://tile.openstreetmap.org https://api.open-meteo.com https://archive-api.open-meteo.com https://overpass-api.de",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
