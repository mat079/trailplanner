/**
 * app/plan/[id]/page.tsx
 * Vue principale du planificateur — stub Étape 0.
 * Sera enrichi aux étapes 1-8.
 */
import { fr } from "@/i18n/fr";

export const metadata = {
  title: "Mon itinéraire",
};

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div
      className="tp-gradient-bg min-h-screen flex flex-col items-center justify-center p-8"
      style={{ color: "var(--tp-text)" }}
    >
      <div className="tp-card p-8 text-center max-w-md w-full">
        <div className="text-4xl mb-4">🏔️</div>
        <h1 className="tp-heading text-2xl mb-2">{fr.app.name}</h1>
        <p style={{ color: "var(--tp-text-muted)" }} className="mb-4 text-sm">
          Trace importée avec succès.
          <br />
          L&apos;affichage de la carte et du profil altimétrique arrive à l&apos;étape 1.
        </p>
        <code
          className="text-xs block px-3 py-2 rounded"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--tp-sage)" }}
        >
          ID : {id}
        </code>
      </div>
    </div>
  );
}
