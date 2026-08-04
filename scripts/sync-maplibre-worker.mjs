/**
 * scripts/sync-maplibre-worker.mjs
 *
 * MapLibre GL calcule l'URL de son web worker en résolvant un chemin relatif
 * (`./maplibre-gl-worker.mjs`) à partir de l'URL de son propre module
 * (`import.meta.url`). Turbopack déplace et hash ce fichier worker vers
 * /_next/static/media/ sans réécrire cette résolution interne à MapLibre, donc
 * l'URL calculée ne correspond jamais à un fichier réel : le worker ne charge
 * jamais, et toute source GeoJSON (le tracé GPX) reste indéfiniment bloquée en
 * chargement, sans la moindre erreur console (TrailMap.tsx, voir setWorkerUrl).
 *
 * On copie donc le fichier worker vers public/ à un chemin stable, pointé
 * explicitement via maplibregl.setWorkerUrl() — le contournement documenté par
 * MapLibre pour les bundlers qui ne supportent pas nativement `new URL(...,
 * import.meta.url)` pour les workers. Exécuté après chaque `npm install` pour
 * rester synchronisé avec la version installée du paquet.
 */
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "node_modules", "maplibre-gl", "dist");
const publicDir = join(__dirname, "..", "public");

// Le worker importe ./maplibre-gl-shared.mjs en relatif : les deux fichiers
// doivent être copiés côte à côte pour que cet import se résolve.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

for (const name of files) {
  const src = join(distDir, name);
  if (!existsSync(src)) {
    console.warn(`[sync-maplibre-worker] Fichier source introuvable : ${src} (maplibre-gl installé ?)`);
    continue;
  }
  const dest = join(publicDir, name);
  copyFileSync(src, dest);
  console.log(`[sync-maplibre-worker] Copié vers ${dest}`);
}
