"use client";

/**
 * components/planning/PrintButton.tsx
 * Déclenche l'impression / l'enregistrement en PDF (dialogue natif du
 * navigateur). Masqué à l'impression elle-même via la classe no-print.
 */
import { Button } from "@/components/ui/button";
import { fr } from "@/i18n/fr";

export default function PrintButton() {
  return (
    <div className="no-print flex justify-end mb-4">
      <Button type="button" onClick={() => window.print()}>
        {fr.pdf.printBtn}
      </Button>
    </div>
  );
}
