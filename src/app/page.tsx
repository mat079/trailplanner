"use client";

import { useRef, useState, useCallback, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { fr } from "@/i18n/fr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ── Icônes inline ─────────────────────────────────────────────────────────────
function IconMountain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5M8.25 4.5L15.75 12 8.25 19.5" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 17.25L12 6l9 11.25H3z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

// ── Composant feature card avec shadcn/ui Card ───────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <Card
      className="tp-card-hover p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          style={{ background: "rgba(45,138,88,0.15)", color: "var(--tp-sage)" }}
          className="p-2 rounded-lg flex-shrink-0"
        >
          {icon}
        </div>
        <div>
          <div className="font-semibold text-sm mb-1" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </div>
          <div className="text-xs" style={{ color: "var(--tp-text-muted)", lineHeight: 1.5 }}>
            {desc}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > 20 * 1024 * 1024) {
        setError(fr.errors.gpxTooLarge);
        return;
      }
      if (!file.name.toLowerCase().endsWith(".gpx")) {
        setError(fr.errors.gpxParse);
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        let sessionId = localStorage.getItem("tp_session_id");
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem("tp_session_id", sessionId);
        }
        formData.append("session_id", sessionId);

        const res = await fetch("/api/gpx", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? fr.errors.generic);
          return;
        }

        router.push(`/plan/${json.data.id}`);
      } catch {
        setError(fr.errors.network);
      } finally {
        setUploading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="tp-gradient-bg min-h-screen flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--tp-border)" }}>
        <div className="flex items-center gap-2">
          <div style={{ color: "var(--tp-sage)" }}>
            <IconMountain />
          </div>
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--tp-text)" }}
          >
            {fr.app.name}
          </span>
        </div>
        <span className="tp-badge tp-badge-green text-xs">V1 · Bêta</span>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Titre */}
        <div className="text-center mb-10 animate-fade-in-up max-w-2xl">
          <div className="tp-badge tp-badge-green mb-4 mx-auto w-fit">
            Randonnée multi-jours · Trail ultra
          </div>
          <h1
            className="tp-heading text-4xl md:text-5xl mb-4"
            style={{ color: "var(--tp-text)" }}
          >
            {fr.landing.title}
          </h1>
          <p className="text-lg" style={{ color: "var(--tp-text-muted)" }}>
            {fr.landing.subtitle}
          </p>
        </div>

        {/* Zone d'upload */}
        <div className="w-full max-w-lg animate-fade-in-up mb-8" style={{ animationDelay: "100ms" }}>
          <div
            id="gpx-dropzone"
            role="button"
            tabIndex={0}
            aria-label={fr.landing.uploadCta}
            className={`tp-dropzone flex flex-col items-center justify-center gap-4 p-10 text-center cursor-pointer ${dragOver ? "drag-over" : ""}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !uploading && fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={onInputChange}
              aria-label="Sélectionner un fichier GPX"
            />

            {uploading ? (
              <>
                <div
                  className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--tp-forest-light)", borderTopColor: "transparent" }}
                />
                <p style={{ color: "var(--tp-text-muted)" }}>{fr.landing.uploadLoading}</p>
              </>
            ) : (
              <>
                <div style={{ color: "var(--tp-forest-light)", opacity: dragOver ? 1 : 0.7 }}>
                  <IconUpload />
                </div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: "var(--tp-text)" }}>
                    {fr.landing.uploadCta}
                  </p>
                  <p className="text-sm" style={{ color: "var(--tp-text-muted)" }}>
                    {fr.landing.uploadHint}
                  </p>
                </div>
                <Button
                  id="upload-btn"
                  variant="default"
                  className="mt-2"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  type="button"
                >
                  {fr.landing.newTripBtn}
                </Button>
              </>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div
              className="mt-3 px-4 py-3 rounded-lg text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--tp-red)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <FeatureCard
            icon={<IconRoute />}
            title="Découpage automatique"
            desc="L'itinéraire est découpé en journées selon votre rythme et le dénivelé."
            delay={0}
          />
          <FeatureCard
            icon={<IconCalendar />}
            title="Météo et ravitaillement"
            desc="Météo par étape, commerces et points d'eau autour de votre trace."
            delay={60}
          />
          <FeatureCard
            icon={<IconShield />}
            title="Checklist intelligente"
            desc="Matériel recommandé selon l'altitude, la météo et la durée de sortie."
            delay={120}
          />
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        className="text-center py-4 px-6 text-xs"
        style={{
          color: "var(--tp-text-muted)",
          borderTop: "1px solid var(--tp-border)",
        }}
      >
        <p>
          {fr.attribution.osm} · {fr.attribution.meteo}
        </p>
      </footer>
    </div>
  );
}
