import {
  PlaceRecommendation,
  SingaporePlace,
  TasteProfile,
} from "./types";

type RecommendationContext = {
  latitude: number;
  longitude: number;
};

type RankedPlace = {
  place: SingaporePlace;
  affinity: number;
  budgetFit: number;
  paceFit: number;
  convenience: number;
  novelty: number;
};

const normalize = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "local life" ? "local" : normalized;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function distanceKm(
  first: RecommendationContext,
  second: RecommendationContext,
) {
  const radius = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const startLatitude = toRadians(first.latitude);
  const endLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function buildEvidence(profile: TasteProfile) {
  const evidence = new Map<string, number>();
  const add = (values: readonly string[], weight: number) => {
    values.forEach((value) => {
      const normalized = normalize(value);
      evidence.set(normalized, (evidence.get(normalized) ?? 0) + weight);
    });
  };

  add(profile.reasons, 5);
  add(profile.interests, 2.5);

  // A nearby place the user already loves is demonstrated taste. A wishlist
  // place is aspirational, so its selected qualities influence results gently.
  if (profile.localPlace && profile.localReasons.length) {
    add(profile.localReasons, profile.localRelationship === "love" ? 3 : 1.75);
  }

  return evidence;
}

function paceFit(place: SingaporePlace, profile: TasteProfile) {
  if (profile.pace === "slow") {
    return place.typicalDurationMinutes >= 75 ? 1 : 0.65;
  }
  if (profile.pace === "packed") {
    return place.typicalDurationMinutes <= 90 ? 1 : 0.45;
  }
  return place.typicalDurationMinutes <= 150 ? 1 : 0.7;
}

function rank(
  place: SingaporePlace,
  profile: TasteProfile,
  context: RecommendationContext,
  evidence: Map<string, number>,
): RankedPlace {
  const tags = new Set([
    normalize(place.category),
    ...place.tags.map(normalize),
  ]);
  const totalWeight = [...evidence.values()].reduce((total, weight) => total + weight, 0);
  const matchedWeight = [...tags].reduce(
    (total, tag) => total + (evidence.get(tag) ?? 0),
    0,
  );
  const maximumPrice = { free: 0, value: 1, flexible: 3 }[profile.budget];
  const distance = distanceKm(context, place);

  return {
    place,
    affinity: totalWeight ? clamp(matchedWeight / totalWeight) : 0,
    budgetFit:
      place.priceLevel <= maximumPrice
        ? 1
        : place.priceLevel === maximumPrice + 1
          ? 0.35
          : 0,
    paceFit: paceFit(place, profile),
    convenience: 1 / (1 + distance / 2),
    novelty: clamp([...tags].filter((tag) => !evidence.has(tag)).length / tags.size),
  };
}

function score(candidate: RankedPlace, kind: PlaceRecommendation["label"]) {
  if (kind === "Best match") {
    return (
      candidate.affinity * 0.62 +
      candidate.budgetFit * 0.16 +
      candidate.paceFit * 0.14 +
      candidate.convenience * 0.08
    );
  }

  if (kind === "Easy choice") {
    return (
      candidate.affinity * 0.28 +
      candidate.budgetFit * 0.25 +
      candidate.paceFit * 0.12 +
      candidate.convenience * 0.35
    );
  }

  return (
    candidate.affinity * 0.36 +
    candidate.novelty * 0.28 +
    candidate.budgetFit * 0.14 +
    candidate.paceFit * 0.1 +
    candidate.convenience * 0.12
  );
}

function matchedTags(place: SingaporePlace, profile: TasteProfile) {
  const placeTags = new Set(place.tags.map(normalize));
  return [...profile.reasons, ...profile.interests]
    .map(normalize)
    .filter((tag, index, tags) => placeTags.has(tag) && tags.indexOf(tag) === index)
    .slice(0, 2);
}

function reasonFor(
  label: PlaceRecommendation["label"],
  place: SingaporePlace,
  profile: TasteProfile,
) {
  const matches = matchedTags(place, profile);
  const traits = matches.length === 2 ? `${matches[0]} and ${matches[1]}` : matches[0];
  const budgetText = place.priceLevel === 0 ? "It is free to enjoy." : "It fits your budget preference.";

  if (label === "Best match") {
    return traits
      ? `It echoes the ${traits} you valued at ${profile.favoritePlace}. ${budgetText}`
      : `Its atmosphere and ${profile.pace} pace make it a strong overall fit. ${budgetText}`;
  }
  if (label === "Easy choice") {
    return `A convenient ${place.category} stop near your current plan${traits ? ` that still matches your taste for ${traits}` : ""}.`;
  }
  return `A different ${place.category} experience${traits ? ` with a familiar thread of ${traits}` : ""}—a low-risk way to try something new.`;
}

function pickDiverse(
  ranked: RankedPlace[],
  label: PlaceRecommendation["label"],
  selected: RankedPlace[],
) {
  const selectedIds = new Set(selected.map(({ place }) => place.id));
  const categories = new Set(selected.map(({ place }) => place.category));
  const areas = new Set(selected.map(({ place }) => place.area));
  const candidates = ranked
    .filter(({ place }) => !selectedIds.has(place.id))
    .sort((first, second) => score(second, label) - score(first, label));

  return (
    candidates.find(({ place }) => !categories.has(place.category) && !areas.has(place.area)) ??
    candidates.find(({ place }) => !categories.has(place.category)) ??
    candidates.find(({ place }) => !areas.has(place.area)) ??
    candidates[0]
  );
}

export function recommendPlaces(
  places: SingaporePlace[],
  profile: TasteProfile,
  context: RecommendationContext,
  excludedIds: string[] = [],
): PlaceRecommendation[] {
  const evidence = buildEvidence(profile);
  const excluded = new Set(excludedIds);
  const candidates = places
    .filter((place) => !excluded.has(place.id))
    .map((place) => rank(place, profile, context, evidence));
  const selected: RankedPlace[] = [];
  const labels: PlaceRecommendation["label"][] = [
    "Best match",
    "Easy choice",
    "Something different",
  ];

  return labels.flatMap((label) => {
    const choice = pickDiverse(candidates, label, selected);
    if (!choice) return [];
    selected.push(choice);
    return [{
      label,
      place: choice.place,
      score: Math.round(score(choice, label) * 100),
      reason: reasonFor(label, choice.place, profile),
    }];
  });
}
