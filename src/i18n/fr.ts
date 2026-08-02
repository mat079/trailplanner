/**
 * i18n/fr.ts
 * Toutes les strings UI en français.
 * Aucun texte ne doit être en dur dans les composants.
 * Pour ajouter l'anglais : créer fr.ts → en.ts et brancher un provider.
 */

export const fr = {
  // ── App ─────────────────────────────────────────────────────────────────
  app: {
    name: "TrailPlanner",
    tagline: "Planifiez vos grandes aventures outdoor",
    description:
      "Préparez vos randonnées multi-jours et trails ultra : découpage d'itinéraire, météo, points d'eau, checklist et bien plus.",
  },

  // ── Navigation ──────────────────────────────────────────────────────────
  nav: {
    newTrip:   "Nouvelle sortie",
    myTrips:   "Mes sorties",
    share:     "Partager",
    print:     "Exporter en PDF",
  },

  // ── Landing / import GPX ─────────────────────────────────────────────────
  landing: {
    title:           "Votre prochaine grande aventure commence ici",
    subtitle:        "Importez votre trace GPX et préparez chaque détail de votre sortie.",
    uploadTitle:     "Importer une trace GPX",
    uploadCta:       "Cliquer ou glisser-déposer un fichier GPX",
    uploadHint:      "Formats acceptés : .gpx — taille max 20 Mo",
    uploadLoading:   "Analyse en cours…",
    uploadError:     "Fichier invalide ou trop volumineux (max 20 Mo).",
    uploadErrorXml:  "Le fichier ne semble pas être un GPX valide.",
    recentTitle:     "Sorties récentes",
    noRecent:        "Aucune sortie enregistrée pour le moment.",
    newTripBtn:      "Commencer",
  },

  // ── Trip overview ─────────────────────────────────────────────────────────
  trip: {
    distance:     "Distance totale",
    elevGain:     "Dénivelé positif",
    elevLoss:     "Dénivelé négatif",
    maxEle:       "Altitude max",
    minEle:       "Altitude min",
    duration:     "Durée estimée",
    days:         "jours",
    day:          "Jour",
    startDate:    "Date de départ",
    noDate:       "Date non définie",
    unnamed:      "Sortie sans nom",
    editName:     "Renommer",
    share:        "Lien de partage copié !",
  },

  // ── Carte ─────────────────────────────────────────────────────────────────
  map: {
    loading:       "Chargement de la carte…",
    layerTrace:    "Trace GPX",
    layerWaypoints:"Points d'étape",
    layerPoi:      "Points d'intérêt",
    fitBounds:     "Centrer sur la trace",
  },

  // ── Profil altimétrique ───────────────────────────────────────────────────
  elevation: {
    title:     "Profil altimétrique",
    altitude:  "Altitude (m)",
    distance:  "Distance (km)",
    gain:      "D+",
    loss:      "D−",
  },

  // ── Découpage en jours ────────────────────────────────────────────────────
  planning: {
    title:           "Découpage par jour",
    paceSpeed:       "Vitesse sur terrain plat",
    paceSpeedUnit:   "km/h",
    paceElevCoeff:   "Temps de montée",
    paceElevUnit:    "min / 100m D+",
    hoursPerDay:     "Heures de marche par jour",
    compute:         "Calculer le découpage",
    computing:       "Calcul en cours…",
    adjustHint:      "Faites glisser les marqueurs sur le profil pour ajuster.",
    dayLabel:        (n: number) => `Jour ${n}`,
    distLabel:       (km: number) => `${km.toFixed(1)} km`,
    elevLabel:       (m: number) => `${m > 0 ? "+" : ""}${Math.round(m)} m`,
    timeLabel:       (h: number) => `~${h.toFixed(1)} h`,
  },

  // ── Points d'étape ────────────────────────────────────────────────────────
  waypoints: {
    title:           "Points d'étape",
    addBivouac:      "Ajouter un bivouac",
    addResupply:     "Ajouter un ravitaillement",
    addCheckpoint:   "Ajouter un point de passage",
    typeBivouac:     "Bivouac",
    typeResupply:    "Ravitaillement",
    typeCheckpoint:  "Point de passage",
    labelPlaceholder:"Nom du point (optionnel)",
    remove:          "Supprimer",
    clickOnMap:      "Cliquez sur la trace pour placer le point.",
  },

  // ── POI ───────────────────────────────────────────────────────────────────
  poi: {
    title:           "Commerces et eau",
    loading:         "Recherche en cours…",
    noResult:        "Aucun commerce ou point d'eau trouvé sur cette section.",
    bakery:          "Boulangerie",
    supermarket:     "Supermarché",
    grocery:         "Épicerie",
    water:           "Point d'eau",
    sectionLabel:    (n: number) => `Section jour ${n}`,
    attribution:     "Données © OpenStreetMap contributors",
    bufferLabel:     "Rayon de recherche",
    bufferUnit:      "m autour de la trace",
    refresh:         "Actualiser",
    staleNotice:     "Données en cache non actualisées (service momentanément indisponible).",
  },

  // ── Météo ─────────────────────────────────────────────────────────────────
  weather: {
    title:           "Météo par étape",
    loading:         "Chargement météo…",
    noDate:          "Définissez une date de départ pour voir la météo.",
    forecast:        "Prévision météo",
    climatology:     "Estimation climatique (hors horizon de prévision)",
    climatologyNote: "La date de départ est dans plus de 16 jours. Ces données sont des moyennes historiques, pas une prévision.",
    feelsLike:       "Ressenti",
    feelsLikeRaw:    "Température",
    wind:            "Vent",
    rain:            "Pluie",
    snow:            "Neige",
    cloudCover:      "Nébulosité",
    windUnit:        "km/h",
    rainUnit:        "mm",
    setDate:         "Date de départ",
    condition: {
      clear:         "Ciel dégagé",
      partly_cloudy: "Partiellement nuageux",
      cloudy:        "Couvert",
      rain:          "Pluie",
      heavy_rain:    "Pluie forte",
      snow:          "Neige",
      storm:         "Orage",
      fog:           "Brouillard",
    },
    attribution:     "Météo fournie par Open-Meteo (CC BY 4.0)",
  },

  // ── Nutrition / glucides ──────────────────────────────────────────────────
  nutrition: {
    title:           "Besoins en glucides",
    perHour:         "g/h de glucides",
    perDay:          "g total sur la journée",
    tripTotal:       "Total sortie",
    intensityLow:    "Endurance (faible intensité)",
    intensityMid:    "Allure soutenue",
    intensityHigh:   "Seuil / effort intense",
    overrideLabel:   "Saisir ma propre cible",
    overridePlaceholder: "ex. 90",
    overrideUnit:    "g/h",
    overrideConfirm: "Valider",
    overrideCancel:  "Annuler",
    overrideReset:   "Revenir au calcul automatique",
    hint:            "Basé sur la distance, le dénivelé et le temps estimé de chaque étape.",
  },

  // ── Checklist ─────────────────────────────────────────────────────────────
  checklist: {
    title:            "Checklist matériel",
    generated:        "Générée selon votre itinéraire",
    categories: {
      navigation:     "Navigation",
      clothing:       "Vêtements",
      bivouac:        "Bivouac",
      nutrition:      "Nutrition",
      safety:         "Sécurité",
      admin:          "Administrative",
    },
    addItem:          "Ajouter un élément",
    addPlaceholder:   "Nom de l'élément…",
    addCategory:      "Catégorie",
    addBtn:           "Ajouter",
    removeItem:       "Supprimer",
    allChecked:       "✓ Tout est prêt !",
    progress:         (done: number, total: number) => `${done} / ${total} éléments cochés`,
    regenerate:       "Régénérer",
    regenerating:     "Génération en cours…",
    empty:            "Aucun élément pour le moment.",
  },

  // ── Export PDF ────────────────────────────────────────────────────────────
  pdf: {
    title:      "Fiche de sortie",
    printBtn:   "Imprimer / Enregistrer en PDF",
    generated:  "Généré par TrailPlanner",
  },

  // ── Erreurs génériques ────────────────────────────────────────────────────
  errors: {
    generic:      "Une erreur est survenue. Veuillez réessayer.",
    notFound:     "Sortie introuvable.",
    network:      "Problème de connexion. Vérifiez votre réseau.",
    gpxParse:     "Impossible de lire ce fichier GPX.",
    gpxTooLarge:  "Fichier trop volumineux (max 20 Mo).",
  },

  // ── Attribution (obligatoire) ─────────────────────────────────────────────
  attribution: {
    osm:      "Carte et POI © OpenStreetMap contributors",
    meteo:    "Météo © Open-Meteo (CC BY 4.0)",
    tiles:    "Tiles © OpenStreetMap contributors, ODbL",
  },
} as const;

export type I18n = typeof fr;
