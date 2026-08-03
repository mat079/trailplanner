# TrailPlanner

Planificateur de sorties itinérantes (trek, ultra, GR...) : upload d'une trace GPX, découpage
automatique en jours, carte + profil altimétrique, points d'étape, météo, nutrition et checklist
matériel générées automatiquement, export PDF de la synthèse.

Aucun compte utilisateur en V1 : chaque sortie est identifiée par un UUID généré côté client
(stocké dans `localStorage`) et n'importe qui disposant du lien peut la consulter/modifier — voir
[Limites connues](#limites-connues).

## Prérequis

- Node.js ≥ 20
- PostgreSQL ≥ 14 (ou Docker pour le lancer en conteneur)
- Docker + Docker Compose (recommandé pour la base de données, en dev comme en prod)

## Démarrage rapide (dev)

```bash
npm install
docker compose up -d db
cp .env.example .env
npm run dev
```

L'app est servie sur [http://localhost:3000](http://localhost:3000). Le schéma est appliqué
automatiquement au premier démarrage du conteneur `db` via `db/init.sql` (voir
[Base de données](#base-de-données) si l'auto-init échoue).

## Variables d'environnement

Copier `.env.example` en `.env` et ajuster :

| Variable              | Description                                                                 | Exemple                                                        |
|------------------------|-----------------------------------------------------------------------------|-----------------------------------------------------------------|
| `DATABASE_URL`        | Connexion PostgreSQL                                                        | `postgres://trailplanner:trailplanner@localhost:5432/trailplanner` |
| `SESSION_SECRET`      | Réservé pour une future authentification — non utilisé actuellement         | *(sans effet pour l'instant)*                                   |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (liens de partage)                                    | `https://trailplanner.example.com`                               |

⚠️ `DATABASE_URL` dépend de l'endroit où tourne l'app : `db` (nom du service Compose) si l'app
elle-même tourne dans Docker sur le même réseau, `localhost` si elle tourne en Node natif sur la
machine hôte. Le fallback par défaut dans le code est `localhost:5432` si la variable est absente.

Si PostgreSQL est injoignable, l'app bascule automatiquement sur un stockage en mémoire
**(dev uniquement — les données sont perdues au redémarrage, à ne jamais utiliser en prod)**.

## Lancer en production

Le `docker-compose.yml` fourni est configuré pour le **développement** (`npm run dev`, montage du
code en volume, `NODE_ENV=development`). Pour un déploiement en production :

**1. Base de données** — réutiliser le service `db` seul, en changeant impérativement les
identifiants par défaut :

```bash
docker compose up -d db
```

Avant de lancer en prod, éditer `docker-compose.yml` pour remplacer
`POSTGRES_PASSWORD: trailplanner` par un mot de passe fort, et mettre à jour `DATABASE_URL` en
conséquence dans `.env`.

**2. Application** — build de production puis lancement via le serveur Next.js :

```bash
npm ci
npm run build
npm run start   # sert sur le port 3000 par défaut (variable PORT pour changer)
```

Mettre l'app derrière un reverse proxy TLS (nginx, Caddy, Traefik...) pour servir en HTTPS — le
projet ne gère pas TLS lui-même. Utiliser un gestionnaire de process (systemd, pm2, ou un
orchestrateur de conteneurs) pour le redémarrage automatique, `npm run start` seul ne redémarre
pas en cas de crash.

## Base de données

Le schéma est défini dans `db/init.sql` (tables, index, extension `pgcrypto` pour les UUID). Il
est appliqué automatiquement par l'image `postgres` au premier démarrage (dossier
`docker-entrypoint-initdb.d`). Pour l'appliquer manuellement (schéma modifié, ou volume déjà
initialisé) :

```bash
docker compose exec -T db psql -U trailplanner -d trailplanner < db/init.sql
```

Note : sur certains environnements Docker Desktop/OrbStack, le montage automatique de
`db/init.sql` peut échouer avec `Operation not permitted` au premier démarrage du conteneur — la
commande ci-dessus contourne le problème en appliquant le schéma directement.

Une purge automatique supprime les sorties inactives depuis plus de 90 jours (tâche interne,
toutes les 24h, voir `purgeOldTrips` dans `src/lib/db.ts`).

## Sécurité

- CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`
  appliqués globalement (`next.config.ts`), scopés aux domaines externes réellement utilisés
  (tuiles OpenStreetMap, Open-Meteo, Overpass).
- Requêtes SQL paramétrées partout (pas de concaténation de valeurs utilisateur).
- Parsing GPX via `fast-xml-parser` (pas de DTD/entités externes → pas d'XXE).
- Taille de fichier GPX limitée à 20 Mo et nombre de points à 50 000 à l'upload.
- Aucune donnée interne (`gpx_raw`, `session_id`) n'est renvoyée par l'API ni exposée côté client.

**Non fait, à décider selon le contexte de déploiement :**
- Pas de rate limiting sur les endpoints (upload GPX, appels Overpass/Open-Meteo) — à mettre en
  place au niveau du reverse proxy ou via un middleware si l'app est exposée publiquement.
- Pas de CSP stricte (nonce-based) : `script-src`/`style-src` autorisent `'unsafe-inline'`, requis
  par Next.js et MapLibre GL en l'état actuel.

## Limites connues

- **Pas d'authentification.** L'accès à une sortie repose uniquement sur la confidentialité de
  son UUID (lien de partage = URL de la sortie). Toute personne ayant le lien peut la modifier.
- La colonne `share_token` existe en base mais n'est pas utilisée par l'application — les liens
  de partage sont l'UUID brut de la sortie.
- Pas de limite de débit (rate limiting) — voir [Sécurité](#sécurité).
- Le stockage en mémoire (fallback sans base de données) n'est prévu que pour le développement.

## Tests

```bash
npm run lint
npx tsc --noEmit
npm test
```
