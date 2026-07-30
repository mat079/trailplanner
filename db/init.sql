-- TrailPlanner V1 — Schéma initial PostgreSQL

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Sorties (trips)
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL,
  share_token      UUID UNIQUE DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL DEFAULT 'Ma sortie',
  start_date       DATE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gpx_raw          TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_trips_session_id ON trips(session_id);
CREATE INDEX IF NOT EXISTS idx_trips_share_token ON trips(share_token);
CREATE INDEX IF NOT EXISTS idx_trips_last_accessed ON trips(last_accessed_at);

-- ============================================================
-- Points GPX bruts (pour les calculs)
-- ============================================================
CREATE TABLE IF NOT EXISTS gpx_points (
  id           SERIAL PRIMARY KEY,
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL,
  lon          DOUBLE PRECISION NOT NULL,
  ele          DOUBLE PRECISION DEFAULT 0,
  dist_cumul   DOUBLE PRECISION DEFAULT 0, -- distance cumulée en mètres
  order_index  INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gpx_points_trip ON gpx_points(trip_id, order_index);

-- ============================================================
-- Jours / étapes
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_days (
  id                SERIAL PRIMARY KEY,
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_index         INT NOT NULL,
  start_point_index INT NOT NULL DEFAULT 0,
  end_point_index   INT NOT NULL DEFAULT 0,
  label             TEXT,
  bivouac_lat       DOUBLE PRECISION,
  bivouac_lon       DOUBLE PRECISION,
  bivouac_ele       DOUBLE PRECISION,
  date              DATE,
  UNIQUE(trip_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days(trip_id);

-- ============================================================
-- Points d'étape manuels (bivouac, ravitaillement, checkpoint)
-- ============================================================
CREATE TABLE IF NOT EXISTS waypoints (
  id            SERIAL PRIMARY KEY,
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('bivouac', 'ravitaillement', 'checkpoint')),
  label         TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  ele           DOUBLE PRECISION,
  point_index   INT,               -- index du point GPX le plus proche (snap)
  dist_cumul    DOUBLE PRECISION,  -- distance cumulée au point snappé
  day_index     INT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_trip ON waypoints(trip_id);

-- ============================================================
-- POI détectés via Overpass (cache TTL 24h)
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_poi (
  id          SERIAL PRIMARY KEY,
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_index   INT,
  type        TEXT NOT NULL,   -- 'bakery' | 'grocery' | 'water' | 'supermarket'
  name        TEXT,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  osm_id      BIGINT,
  fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_trip ON cached_poi(trip_id, day_index);
CREATE INDEX IF NOT EXISTS idx_poi_fetched ON cached_poi(fetched_at);

-- ============================================================
-- Checklist
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id         SERIAL PRIMARY KEY,
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  category   TEXT NOT NULL,  -- 'navigation' | 'vêtements' | 'bivouac' | 'nutrition' | 'sécurité' | 'administrative'
  checked    BOOLEAN NOT NULL DEFAULT FALSE,
  custom     BOOLEAN NOT NULL DEFAULT FALSE,  -- true = ajouté par l'utilisateur
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_checklist_trip ON checklist_items(trip_id);

-- ============================================================
-- Purge automatique des trips anonymes inactifs depuis 90 jours
-- À appeler depuis un cron ou au démarrage de l'app.
-- CREATE OR REPLACE FUNCTION purge_old_trips() RETURNS void AS $$
--   DELETE FROM trips WHERE last_accessed_at < NOW() - INTERVAL '90 days';
-- $$ LANGUAGE sql;
-- ============================================================
