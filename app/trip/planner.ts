import type {
  PlaceTag,
  SingaporePlace,
} from "../personalization/types";
import {
  tripDayOptions,
  type AnchorTasteSignals,
  type FullTripItinerary,
  type MustGoTripPlan,
  type TripDayCount,
  type TripItineraryStop,
  type TripSetup,
} from "./types";

const FEATURED_MUST_GO_IDS = [
  "gardens-by-the-bay-supertree-grove",
  "merlion-park",
  "national-gallery-singapore",
  "maxwell-food-centre",
  "sultan-mosque",
  "singapore-botanic-gardens",
  "artscience-museum",
  "jewel-rain-vortex",
] as const;

const CONTROLLED_TAG_ORDER: readonly PlaceTag[] = [
  "culture",
  "food",
  "nature",
  "architecture",
  "views",
  "local",
  "design",
  "quiet",
  "lively",
  "family",
  "hidden-gem",
  "local life",
];

const categoryTasteTag: Record<SingaporePlace["category"], PlaceTag> = {
  culture: "culture",
  food: "food",
  nature: "nature",
  design: "design",
  view: "views",
};

export function toTripDayCount(value: number): TripDayCount {
  const rounded = Number.isFinite(value) ? Math.round(value) : 1;
  const minimum = tripDayOptions[0];
  const maximum = tripDayOptions[tripDayOptions.length - 1];
  return Math.min(maximum, Math.max(minimum, rounded)) as TripDayCount;
}

export function createTripSetup(
  dayCount: number,
  mustGoPlaceIds: readonly string[] = [],
): TripSetup {
  return {
    dayCount: toTripDayCount(dayCount),
    mustGoPlaceIds: [...new Set(mustGoPlaceIds.filter(Boolean))],
  };
}

export function getSelectedMustGoPlaces(
  places: readonly SingaporePlace[],
  mustGoPlaceIds: readonly string[],
): SingaporePlace[] {
  const selectedIds = new Set(mustGoPlaceIds);
  return places.filter((place) => selectedIds.has(place.id));
}

/**
 * Returns a stable, deliberately varied starter set for the setup screen.
 * The fallback keeps the helper useful if the seed catalog changes later.
 */
export function getFeaturedMustGoPlaces(
  places: readonly SingaporePlace[],
  limit: number = FEATURED_MUST_GO_IDS.length,
): SingaporePlace[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  const byId = new Map(places.map((place) => [place.id, place]));
  const featured = FEATURED_MUST_GO_IDS.flatMap((id) => {
    const place = byId.get(id);
    return place ? [place] : [];
  });
  const featuredIds = new Set(featured.map((place) => place.id));
  const fallback = places
    .filter((place) => !featuredIds.has(place.id))
    .sort((first, second) => first.id.localeCompare(second.id));

  return [...featured, ...fallback].slice(0, safeLimit);
}

/**
 * Converts the user's fixed anchors into controlled vocabulary that can be
 * blended into recommendation scoring without interpreting free-form text.
 */
export function getAnchorTasteSignals(
  places: readonly SingaporePlace[],
  mustGoPlaceIds: readonly string[],
  tagLimit = 8,
): AnchorTasteSignals {
  const anchors = getSelectedMustGoPlaces(places, mustGoPlaceIds);
  const weights = new Map<PlaceTag, number>();

  anchors.forEach((place) => {
    const categoryTag = categoryTasteTag[place.category];
    weights.set(categoryTag, (weights.get(categoryTag) ?? 0) + 2);
    place.tags.forEach((tag) => {
      weights.set(tag, (weights.get(tag) ?? 0) + 1);
    });
  });

  const order = new Map(CONTROLLED_TAG_ORDER.map((tag, index) => [tag, index]));
  const tags = [...weights]
    .sort(([firstTag, firstWeight], [secondTag, secondWeight]) =>
      secondWeight - firstWeight ||
      (order.get(firstTag) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(secondTag) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, Math.max(0, Math.floor(tagLimit)))
    .map(([tag]) => tag);

  return { tags, anchorCount: anchors.length };
}

export function getAnchorTasteTags(
  places: readonly SingaporePlace[],
  mustGoPlaceIds: readonly string[],
  tagLimit = 8,
): PlaceTag[] {
  return getAnchorTasteSignals(places, mustGoPlaceIds, tagLimit).tags;
}

export function distributeMustGoPlaces(
  places: readonly SingaporePlace[],
  setup: TripSetup,
): MustGoTripPlan {
  const normalizedSetup = createTripSetup(
    setup.dayCount,
    setup.mustGoPlaceIds,
  );
  const knownIds = new Set(places.map((place) => place.id));
  const selectedAnchors = getSelectedMustGoPlaces(
    places,
    normalizedSetup.mustGoPlaceIds,
  );
  const unknownPlaceIds = normalizedSetup.mustGoPlaceIds.filter(
    (id) => !knownIds.has(id),
  );
  const orderedAnchors = orderByGeographicClusters(selectedAnchors);
  const counts = balancedDayCounts(
    orderedAnchors.length,
    normalizedSetup.dayCount,
  );
  let cursor = 0;
  const days = counts.map((count, index) => {
    const anchors = orderedAnchors.slice(cursor, cursor + count);
    cursor += count;
    return {
      dayNumber: index + 1,
      anchors,
      areas: [...new Set(anchors.map((place) => place.area))],
      estimatedVisitMinutes: anchors.reduce(
        (total, place) => total + place.typicalDurationMinutes,
        0,
      ),
    };
  });

  return {
    setup: normalizedSetup,
    days,
    selectedAnchors: orderedAnchors,
    unknownPlaceIds,
  };
}

/**
 * Builds a complete first-pass itinerary around the user's non-negotiable
 * anchors. Four stops is a soft daily ceiling: a day can exceed it only when
 * that is required to keep every valid must-go place exactly once.
 */
export function buildTripItinerary(
  places: readonly SingaporePlace[],
  setup: TripSetup,
  preferredTags: readonly PlaceTag[] = [],
): FullTripItinerary {
  const uniquePlaces = [
    ...new Map(places.map((place) => [place.id, place])).values(),
  ];
  const anchorPlan = distributeMustGoPlaces(uniquePlaces, setup);

  if (uniquePlaces.length < anchorPlan.setup.dayCount) {
    throw new Error(
      "The place catalog needs at least one unique place for every trip day.",
    );
  }

  const days = anchorPlan.days.map((day) => ({
    dayNumber: day.dayNumber,
    stops: day.anchors.map((place): TripItineraryStop => ({
      place,
      source: "must-go",
    })),
  }));
  const usedIds = new Set(anchorPlan.selectedAnchors.map((place) => place.id));
  const catalogOrder = new Map(
    uniquePlaces.map((place, index) => [place.id, index]),
  );
  const preferred = new Set(
    preferredTags.map((tag) => (tag === "local life" ? "local" : tag)),
  );

  // Seed anchorless days before filling any optional slots, so every day is
  // useful even when the user selects only one or two must-go places.
  days.forEach((day) => {
    if (day.stops.length) return;
    const candidate = pickRecommendation(
      uniquePlaces,
      usedIds,
      day.stops,
      preferred,
      catalogOrder,
      allStops(days),
    );
    if (!candidate) return;
    day.stops.push({ place: candidate, source: "recommended" });
    usedIds.add(candidate.id);
  });

  // Round-robin filling prevents earlier days from consuming all nearby
  // options before later days receive a balanced plan.
  for (let slot = 1; slot <= 4; slot += 1) {
    days.forEach((day) => {
      if (day.stops.length >= 4 || day.stops.length >= slot + 1) return;
      const candidate = pickRecommendation(
        uniquePlaces,
        usedIds,
        day.stops,
        preferred,
        catalogOrder,
        allStops(days),
      );
      if (!candidate) return;
      day.stops.push({ place: candidate, source: "recommended" });
      usedIds.add(candidate.id);
    });
  }

  // Present each day in a practical local order after recommendation filling.
  days.forEach((day) => {
    const sourceById = new Map(
      day.stops.map((stop) => [stop.place.id, stop.source]),
    );
    day.stops = orderByGeographicClusters(day.stops.map((stop) => stop.place))
      .map((place) => ({ place, source: sourceById.get(place.id)! }));
  });

  return {
    setup: anchorPlan.setup,
    days,
    unknownPlaceIds: anchorPlan.unknownPlaceIds,
  };
}

function pickRecommendation(
  places: readonly SingaporePlace[],
  usedIds: ReadonlySet<string>,
  dayStops: readonly TripItineraryStop[],
  preferredTags: ReadonlySet<PlaceTag>,
  catalogOrder: ReadonlyMap<string, number>,
  tripStops: readonly TripItineraryStop[],
) {
  const candidates = places.filter((place) => !usedIds.has(place.id));
  if (!candidates.length) return undefined;

  return candidates.sort((first, second) => {
    const firstScore = recommendationScore(
      first,
      dayStops,
      preferredTags,
      tripStops,
    );
    const secondScore = recommendationScore(
      second,
      dayStops,
      preferredTags,
      tripStops,
    );
    return (
      secondScore - firstScore ||
      (catalogOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
        (catalogOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER) ||
      first.id.localeCompare(second.id)
    );
  })[0];
}

function recommendationScore(
  place: SingaporePlace,
  dayStops: readonly TripItineraryStop[],
  preferredTags: ReadonlySet<PlaceTag>,
  tripStops: readonly TripItineraryStop[],
) {
  const placeTags = new Set<PlaceTag>([
    categoryTasteTag[place.category],
    ...place.tags,
  ]);
  const preferredMatch = preferredTags.size
    ? [...preferredTags].filter((tag) => placeTags.has(tag)).length /
      preferredTags.size
    : 0;

  if (!dayStops.length) {
    const existingPlaces = tripStops.map((stop) => stop.place);
    const separation = existingPlaces.length
      ? Math.min(
          15,
          Math.min(...existingPlaces.map((other) => distanceKm(place, other))),
        ) / 15
      : 0;
    return separation * 1.25 + preferredMatch * 0.75;
  }

  const dayPlaces = dayStops.map((stop) => stop.place);
  const nearestDistance = Math.min(
    ...dayPlaces.map((other) => distanceKm(place, other)),
  );
  const sameArea = dayPlaces.some((other) => other.area === place.area);
  const existingCategories = new Set(dayPlaces.map((other) => other.category));
  const categoryDiversity = existingCategories.has(place.category) ? 0 : 0.6;

  return (
    5 / (1 + nearestDistance) +
    (sameArea ? 3 : 0) +
    categoryDiversity +
    preferredMatch * 0.75
  );
}

function allStops(
  days: readonly { stops: readonly TripItineraryStop[] }[],
): TripItineraryStop[] {
  return days.flatMap((day) => day.stops);
}

function balancedDayCounts(itemCount: number, dayCount: number): number[] {
  const base = Math.floor(itemCount / dayCount);
  const remainder = itemCount % dayCount;
  return Array.from(
    { length: dayCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function orderByGeographicClusters(
  places: readonly SingaporePlace[],
): SingaporePlace[] {
  if (places.length < 2) return [...places];

  const remaining = [...places].sort(westToEastThenId);
  const ordered = [remaining.shift()!];

  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    remaining.sort((first, second) => {
      const firstScore = clusterDistance(current, first);
      const secondScore = clusterDistance(current, second);
      return firstScore - secondScore || westToEastThenId(first, second);
    });
    ordered.push(remaining.shift()!);
  }

  return ordered;
}

function westToEastThenId(first: SingaporePlace, second: SingaporePlace) {
  return (
    first.longitude - second.longitude ||
    first.latitude - second.latitude ||
    first.id.localeCompare(second.id)
  );
}

function clusterDistance(first: SingaporePlace, second: SingaporePlace) {
  const distance = distanceKm(first, second);
  // Shared visitor areas are a useful signal beyond raw coordinates: entrances
  // can be far apart while still belonging to one practical walking cluster.
  return first.area === second.area ? distance * 0.35 : distance;
}

function distanceKm(first: SingaporePlace, second: SingaporePlace) {
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
