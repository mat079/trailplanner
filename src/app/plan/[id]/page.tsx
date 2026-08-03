/**
 * app/plan/[id]/page.tsx
 * Vue principale du planificateur — fetch serveur, rendu interactif délégué à PlanClient.
 */
import { notFound } from "next/navigation";
import { getTrip, getTripPoints } from "@/lib/db";
import { douglasPeucker, adaptiveEpsilon } from "@/modules/gpx/simplify";
import { toPublicTrip } from "@/types";
import PlanClient from "@/components/planning/PlanClient";

export const metadata = {
  title: "Mon itinéraire",
};

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) {
    notFound();
  }

  const points = await getTripPoints(id);
  const eps = adaptiveEpsilon(points.length);
  const simplifiedPoints = douglasPeucker(points, eps);

  return <PlanClient trip={toPublicTrip(trip)} simplifiedPoints={simplifiedPoints} />;
}
