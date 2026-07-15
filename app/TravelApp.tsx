"use client";

import { useEffect, useMemo, useState } from "react";
import { singaporePlaces } from "./data/places";
import TastePanel from "./personalization/TastePanel";
import { recommendPlaces } from "./personalization/recommend";
import {
  interestOptions,
  tasteReasonOptions,
  type PlaceTag,
  type SingaporePlace,
  type TasteProfile,
} from "./personalization/types";
import SingaporeMap from "./SingaporeMap";
import {
  buildTripItinerary,
  createTripSetup,
  getAnchorTasteTags,
  type TripItineraryDay,
  type TripSetup,
} from "./trip";
import TripSetupPanel from "./trip/TripSetupPanel";

type Stop = {
  id: number;
  time: string;
  name: string;
  area: string;
  type: "sight" | "food" | "nature";
  duration: string;
  walk: string;
  latitude: number;
  longitude: number;
  note: string;
  placeId: string;
  source: "must-go" | "recommended";
  isMustGo: boolean;
};

type RouteLeg = {
  fromId: number;
  toId: number;
  durationSeconds: number;
  distanceMeters: number;
  coordinates: [number, number][];
  source: "onemap" | "fallback";
};

type RoutePlan = {
  provider: "onemap";
  mode: "walk";
  hasFallback: boolean;
  durationSeconds: number;
  distanceMeters: number;
  coordinates: [number, number][];
  legs: RouteLeg[];
};

const initialStops: Stop[] = [
  {
    id: 1,
    time: "9:30 AM",
    name: "Buddha Tooth Relic Temple",
    area: "Chinatown",
    type: "sight",
    duration: "60 min",
    walk: "Start here",
    latitude: 1.2816,
    longitude: 103.8442,
    note: "A calm cultural start, before the late-morning crowds.",
    placeId: "buddha-tooth-relic-temple",
    source: "recommended",
    isMustGo: false,
  },
  {
    id: 2,
    time: "11:15 AM",
    name: "Maxwell Food Centre",
    area: "Tanjong Pagar",
    type: "food",
    duration: "75 min",
    walk: "7 min walk",
    latitude: 1.2803,
    longitude: 103.8446,
    note: "Local lunch choices that fit your casual, budget-friendly style.",
    placeId: "maxwell-food-centre",
    source: "recommended",
    isMustGo: false,
  },
  {
    id: 3,
    time: "1:15 PM",
    name: "Gardens by the Bay",
    area: "Marina Bay",
    type: "nature",
    duration: "2 hr",
    walk: "12 min ride",
    latitude: 1.2816,
    longitude: 103.8636,
    note: "The afternoon light is great, with indoor domes if it rains.",
    placeId: "gardens-by-the-bay-supertree-grove",
    source: "recommended",
    isMustGo: false,
  },
  {
    id: 4,
    time: "4:00 PM",
    name: "Kampong Glam",
    area: "Bugis",
    type: "sight",
    duration: "90 min",
    walk: "15 min ride",
    latitude: 1.3023,
    longitude: 103.8591,
    note: "Independent shops, street art and an easy golden-hour walk.",
    placeId: "haji-lane",
    source: "recommended",
    isMustGo: false,
  },
];

const filters = [
  ["all", "All"],
  ["food", "Eat"],
  ["sight", "Explore"],
  ["nature", "Outdoors"],
] as const;

const tasteStorageKeys = {
  profile: "roamly:taste-profile",
  savedPlaces: "roamly:saved-places",
  dismissedPlaces: "roamly:dismissed-places",
} as const;

const tripStorageKey = "roamly:trip-v1";

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function readStoredProfile(value: string | null): TasteProfile | null {
  if (!value) return null;

  try {
    const profile = JSON.parse(value) as Partial<TasteProfile>;
    const localReasons = profile.localReasons ?? [];
    const allowedReasons = tasteReasonOptions as readonly string[];
    const allowedInterests = interestOptions as readonly string[];
    if (
      typeof profile.favoritePlace !== "string" ||
      !profile.favoritePlace.trim() ||
      !Array.isArray(profile.reasons) ||
      profile.reasons.length === 0 ||
      !profile.reasons.every(
        (reason) =>
          typeof reason === "string" && allowedReasons.includes(reason),
      ) ||
      typeof profile.localPlace !== "string" ||
      (profile.localRelationship !== "love" && profile.localRelationship !== "want") ||
      !Array.isArray(localReasons) ||
      !localReasons.every(
        (reason) =>
          typeof reason === "string" && allowedReasons.includes(reason),
      ) ||
      !Array.isArray(profile.interests) ||
      !profile.interests.every(
        (interest) =>
          typeof interest === "string" && allowedInterests.includes(interest),
      ) ||
      !["slow", "balanced", "packed"].includes(profile.pace ?? "") ||
      !["free", "value", "flexible"].includes(profile.budget ?? "")
    ) {
      return null;
    }

    return { ...profile, localReasons } as TasteProfile;
  } catch {
    return null;
  }
}

function readStoredIds(value: string | null) {
  if (!value) return [];
  try {
    const ids = JSON.parse(value) as unknown;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function storeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Personalization still works for the current session if storage is blocked.
  }
}

function readStoredTripSetup(value: string | null): TripSetup | null {
  if (!value) return null;

  try {
    const candidate = JSON.parse(value) as {
      version?: unknown;
      dayCount?: unknown;
      mustGoPlaceIds?: unknown;
    };
    if (
      candidate.version !== 1 ||
      typeof candidate.dayCount !== "number" ||
      !Array.isArray(candidate.mustGoPlaceIds)
    ) {
      return null;
    }

    const knownPlaceIds = new Set(singaporePlaces.map((place) => place.id));
    const mustGoPlaceIds = candidate.mustGoPlaceIds.filter(
      (id): id is string => typeof id === "string" && knownPlaceIds.has(id),
    );
    return createTripSetup(candidate.dayCount, mustGoPlaceIds);
  } catch {
    return null;
  }
}

function placeType(place: SingaporePlace): Stop["type"] {
  if (place.category === "food") return "food";
  if (place.category === "nature") return "nature";
  return "sight";
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

function timeLabel(minutesAfterMidnight: number) {
  if (minutesAfterMidnight >= 21 * 60) return "Flexible";
  const hours = Math.floor(minutesAfterMidnight / 60);
  const minutes = minutesAfterMidnight % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function itineraryDayToStops(day: TripItineraryDay): Stop[] {
  const mustGoNames = day.stops
    .filter((stop) => stop.source === "must-go")
    .map((stop) => stop.place.name);
  let nextStartMinutes = 9 * 60 + 30;

  return day.stops.map(({ place, source }, index) => {
    const startTime = timeLabel(nextStartMinutes);
    nextStartMinutes += place.typicalDurationMinutes + 30;

    return {
      id: index + 1,
      time: startTime,
      name: place.name,
      area: place.area,
      type: placeType(place),
      duration: durationLabel(place.typicalDurationMinutes),
      walk: index === 0 ? "Start here" : "Route updating",
      latitude: place.latitude,
      longitude: place.longitude,
      note:
        source === "must-go"
          ? "Locked into this day because you marked it as a must-go place."
          : mustGoNames.length
            ? `Chosen as a nearby complement to ${mustGoNames[0]}.`
            : place.summary,
      placeId: place.id,
      source,
      isMustGo: source === "must-go",
    };
  });
}

function buildStopPlans(setup: TripSetup, profile: TasteProfile | null) {
  const anchorTags = getAnchorTasteTags(
    singaporePlaces,
    setup.mustGoPlaceIds,
  );
  const preferredTags: PlaceTag[] = [
    ...(profile?.reasons ?? []),
    ...(profile?.interests ?? []),
    ...(profile?.localReasons ?? []),
    ...anchorTags,
  ];
  return buildTripItinerary(singaporePlaces, setup, preferredTags).days.map(
    itineraryDayToStops,
  );
}

export default function TravelApp() {
  const [dayPlans, setDayPlans] = useState<Stop[][]>([initialStops]);
  const [activeStop, setActiveStop] = useState(1);
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [day, setDay] = useState(1);
  const [locateRequest, setLocateRequest] = useState(0);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [aiOpen, setAiOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [tastePanelMode, setTastePanelMode] = useState<"profile" | "recommendations" | null>(null);
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>([]);
  const [dismissedPlaceIds, setDismissedPlaceIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [tripSetup, setTripSetup] = useState<TripSetup | null>(null);
  const [tripSetupDraft, setTripSetupDraft] = useState<TripSetup>(
    createTripSetup(3),
  );
  const [tripSetupOpen, setTripSetupOpen] = useState(false);

  const stops = dayPlans[day - 1] ?? dayPlans[0] ?? initialStops;
  const visibleStops = useMemo(
    () => stops.filter((stop) => filter === "all" || stop.type === filter),
    [filter, stops],
  );
  const visibleStopIds = useMemo(
    () => visibleStops.map((stop) => stop.id),
    [visibleStops],
  );
  const active =
    stops.find((stop) => stop.id === activeStop) ?? stops[0] ?? initialStops[0];
  const mustGoPlaceIds = useMemo(
    () => tripSetup?.mustGoPlaceIds ?? [],
    [tripSetup],
  );
  const anchorTasteTags = useMemo(
    () => getAnchorTasteTags(singaporePlaces, mustGoPlaceIds),
    [mustGoPlaceIds],
  );
  const scheduledPlaceIds = useMemo(
    () => dayPlans.flatMap((plan) => plan.map((stop) => stop.placeId)),
    [dayPlans],
  );
  const recommendationLatitude = userLocation?.latitude ?? active.latitude;
  const recommendationLongitude = userLocation?.longitude ?? active.longitude;
  const personalizedRecommendations = useMemo(
    () =>
      tasteProfile
        ? recommendPlaces(
            singaporePlaces,
            tasteProfile,
            {
              latitude: recommendationLatitude,
              longitude: recommendationLongitude,
            },
            [...dismissedPlaceIds, ...scheduledPlaceIds],
            anchorTasteTags,
          )
        : [],
    [
      dismissedPlaceIds,
      anchorTasteTags,
      recommendationLatitude,
      recommendationLongitude,
      scheduledPlaceIds,
      tasteProfile,
    ],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let storedProfile: TasteProfile | null = null;
      let storedTripSetup: TripSetup | null = null;
      let storedSavedPlaces: string[] = [];
      let storedDismissedPlaces: string[] = [];

      try {
        storedProfile = readStoredProfile(
          window.localStorage.getItem(tasteStorageKeys.profile),
        );
        storedSavedPlaces = readStoredIds(
          window.localStorage.getItem(tasteStorageKeys.savedPlaces),
        );
        storedDismissedPlaces = readStoredIds(
          window.localStorage.getItem(tasteStorageKeys.dismissedPlaces),
        );
        storedTripSetup = readStoredTripSetup(
          window.localStorage.getItem(tripStorageKey),
        );
      } catch {
        // Private browsing can block storage; keep the in-memory experience.
      }

      setTasteProfile(storedProfile);
      setSavedPlaceIds(storedSavedPlaces);
      setDismissedPlaceIds(storedDismissedPlaces);
      setTripSetup(storedTripSetup);

      if (storedTripSetup) {
        setTripSetupDraft(storedTripSetup);
        setDayPlans(buildStopPlans(storedTripSetup, storedProfile));
      } else {
        setTripSetupOpen(true);
      }

      if (storedTripSetup && !storedProfile) {
        setTastePanelMode("profile");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWalkingRoutes() {
      if (stops.length < 2) return;

      try {
        const chunks: Stop[][] = [];
        for (let start = 0; start < stops.length - 1; start += 9) {
          chunks.push(stops.slice(start, start + 10));
        }

        const plans = await Promise.all(
          chunks.map(async (chunk) => {
            const response = await fetch("/api/routes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stops: chunk.map(({ id, latitude, longitude }) => ({
                  id,
                  latitude,
                  longitude,
                })),
              }),
              signal: controller.signal,
            });
            const payload = (await response.json()) as
              | RoutePlan
              | { error?: string; code?: string };

            if (!response.ok) {
              throw new Error("Walking route unavailable");
            }
            return payload as RoutePlan;
          }),
        );

        setRoutePlan({
          provider: "onemap",
          mode: "walk",
          hasFallback: plans.some((plan) => plan.hasFallback),
          durationSeconds: plans.reduce(
            (total, plan) => total + plan.durationSeconds,
            0,
          ),
          distanceMeters: plans.reduce(
            (total, plan) => total + plan.distanceMeters,
            0,
          ),
          coordinates: plans.flatMap((plan, index) =>
            index === 0 ? plan.coordinates : plan.coordinates.slice(1),
          ),
          legs: plans.flatMap((plan) => plan.legs),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRoutePlan(null);
      }
    }

    loadWalkingRoutes();
    return () => controller.abort();
  }, [stops]);

  const replaceStop = (id: number) => {
    setRoutePlan(null);
    setDayPlans((current) => {
      const selectedDay = current[day - 1];
      const stop = selectedDay?.find((candidate) => candidate.id === id);
      if (!selectedDay || !stop || stop.isMustGo) return current;

      const scheduledIds = new Set(
        current.flatMap((plan) => plan.map((candidate) => candidate.placeId)),
      );
      const replacement = singaporePlaces
        .filter((place) => !scheduledIds.has(place.id))
        .sort((first, second) => {
          const firstScore =
            Number(placeType(first) === stop.type) * 2 +
            Number(first.area === stop.area);
          const secondScore =
            Number(placeType(second) === stop.type) * 2 +
            Number(second.area === stop.area);
          return secondScore - firstScore || first.id.localeCompare(second.id);
        })[0];
      if (!replacement) return current;

      const replacementStop: Stop = {
        ...itineraryDayToStops({
          dayNumber: day,
          stops: [{ place: replacement, source: "recommended" }],
        })[0],
        id: stop.id,
        time: stop.time,
        walk: stop.walk,
        note: `A fresh ${replacement.category} alternative that keeps this day geographically sensible.`,
      };

      return current.map((plan, index) =>
        index === day - 1
          ? plan.map((candidate) =>
              candidate.id === id ? replacementStop : candidate,
            )
          : plan,
      );
    });
  };

  const openTripSetup = () => {
    setTripSetupDraft(
      tripSetup ?? createTripSetup(Math.max(1, dayPlans.length)),
    );
    setTripSetupOpen(true);
  };

  const saveTripSetup = () => {
    const normalizedSetup = createTripSetup(
      tripSetupDraft.dayCount,
      tripSetupDraft.mustGoPlaceIds,
    );
    setTripSetup(normalizedSetup);
    setTripSetupDraft(normalizedSetup);
    setDayPlans(buildStopPlans(normalizedSetup, tasteProfile));
    setDay(1);
    setActiveStop(1);
    setRoutePlan(null);
    setTripSetupOpen(false);
    storeJson(tripStorageKey, { version: 1, ...normalizedSetup });

    if (!tasteProfile) {
      setTastePanelMode("profile");
    }
  };

  const openTastePanel = () => {
    if (!tripSetup) {
      openTripSetup();
      return;
    }
    setAiOpen(false);
    setTastePanelMode(tasteProfile ? "recommendations" : "profile");
  };

  const saveTasteProfile = (profile: TasteProfile) => {
    setTasteProfile(profile);
    setDismissedPlaceIds([]);
    storeJson(tasteStorageKeys.profile, profile);
    storeJson(tasteStorageKeys.dismissedPlaces, []);
    if (tripSetup) {
      setDayPlans(buildStopPlans(tripSetup, profile));
      setDay(1);
      setActiveStop(1);
      setRoutePlan(null);
    }
    setTastePanelMode("recommendations");
  };

  const toggleSavedPlace = (placeId: string) => {
    setSavedPlaceIds((current) => {
      const next = current.includes(placeId)
        ? current.filter((id) => id !== placeId)
        : [...current, placeId];
      storeJson(tasteStorageKeys.savedPlaces, next);
      return next;
    });
  };

  const dismissPlace = (placeId: string) => {
    setDismissedPlaceIds((current) => {
      const next = [...new Set([...current, placeId])];
      const safeNext =
        next.length > singaporePlaces.length - 3 ? [placeId] : next;
      storeJson(tasteStorageKeys.dismissedPlaces, safeNext);
      return safeNext;
    });
  };

  return (
    <main className="app-shell">
      <section className="map-panel" aria-label="Singapore itinerary map">
        <SingaporeMap
          stops={stops}
          visibleStopIds={visibleStopIds}
          activeStopId={activeStop}
          locateRequest={locateRequest}
          onSelectStop={setActiveStop}
          onLocationStatus={setLocationStatus}
          onLocationFound={setUserLocation}
        />

        <header className="topbar">
          <a className="brand" href="#" aria-label="Roamly home">
            <span className="brand-mark">R</span>
            <span>roamly</span>
          </a>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setSaved(!saved)} aria-label="Save trip">
              {saved ? "♥" : "♡"}
            </button>
            <button className="avatar" onClick={() => setTastePanelMode("profile")} aria-label="Open taste profile">JC</button>
          </div>
        </header>

        <div className="search-wrap">
          <button className="search-box" onClick={openTastePanel}>
            <span className="spark">✦</span>
            <span>Find places based on what you love...</span>
            <kbd>FOR YOU</kbd>
          </button>
          <div className="filter-row" aria-label="Map filters">
            {filters.map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)} className={filter === value ? "selected" : ""}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          className={`locate-button ${locationStatus === "found" ? "located" : ""}`}
          onClick={() => setLocateRequest((request) => request + 1)}
          disabled={locationStatus === "loading"}
        >
          <span className="locate-arrow">⌖</span>
          {locationStatus === "loading"
            ? "Finding you..."
            : locationStatus === "found"
              ? "Location found"
              : locationStatus === "error"
                ? "Location unavailable"
                : "Use my location"}
        </button>

        <aside className="desktop-card" aria-live="polite">
          <span className="eyebrow">STOP {active.id} · {active.time}</span>
          <h2>{active.name}</h2>
          <p>{active.note}</p>
          <div className="card-meta"><span>{active.area}</span><span>{active.duration}</span></div>
          {active.isMustGo ? (
            <div className="must-go-card-note">✓ Must-go place</div>
          ) : (
            <button onClick={() => replaceStop(active.id)}>Find another like this</button>
          )}
        </aside>
      </section>

      <section className="plan-panel">
        <div className="drag-handle" />
        <div className="plan-heading">
          <div>
            <span className="eyebrow">
              DAY {day} OF {tripSetup?.dayCount ?? dayPlans.length}
            </span>
            <h1>
              {(tripSetup?.dayCount ?? dayPlans.length) === 1
                ? "A day made for you"
                : `${tripSetup?.dayCount ?? dayPlans.length} days made for you`}
            </h1>
            <button className="trip-shape-button" onClick={openTripSetup}>
              {tripSetup?.dayCount ?? dayPlans.length} days
              <span>•</span>
              {mustGoPlaceIds.length} must-go
            </button>
          </div>
          <button className="more-button" onClick={openTripSetup} aria-label="Edit trip length and must-go places">•••</button>
        </div>

        <div className="day-tabs" role="tablist" aria-label="Trip days">
          {Array.from(
            { length: tripSetup?.dayCount ?? dayPlans.length },
            (_, index) => index + 1,
          ).map((number) => (
            <button
              key={number}
              role="tab"
              aria-selected={day === number}
              className={day === number ? "active" : ""}
              onClick={() => {
                setDay(number);
                setActiveStop(1);
                setRoutePlan(null);
              }}
            >
              <small>DAY</small>
              <strong>{number}</strong>
            </button>
          ))}
          {(tripSetup?.dayCount ?? dayPlans.length) < 7 && (
            <button
              className="add-day"
              aria-label="Add a day"
              onClick={() => {
                setTripSetupDraft(
                  createTripSetup(
                    (tripSetup?.dayCount ?? dayPlans.length) + 1,
                    mustGoPlaceIds,
                  ),
                );
                setTripSetupOpen(true);
              }}
            >
              ＋
            </button>
          )}
        </div>

        {stops.length ? (
          <div className="timeline">
            {stops.map((stop, index) => (
              <article className={`stop-row ${activeStop === stop.id ? "active" : ""}`} key={stop.id} onClick={() => setActiveStop(stop.id)}>
                <div className="timeline-track">
                  <span className={`timeline-dot dot-${stop.type}`}>{stop.id}</span>
                  {index < stops.length - 1 && <span className="connector" />}
                </div>
                <div className="stop-content">
                  <div className="stop-time">{stop.time} <span>· {stop.duration}</span></div>
                  <h3>
                    <span className="stop-name">{stop.name}</span>
                    {stop.isMustGo && <span className="must-go-badge">Must go</span>}
                  </h3>
                  <p>
                    {stop.area} area <span>•</span>{" "}
                    {index === 0
                      ? "Start here"
                      : routePlan?.legs[index - 1]
                        ? `${routePlan.legs[index - 1].source === "fallback" ? "~" : ""}${Math.max(1, Math.round(routePlan.legs[index - 1].durationSeconds / 60))} min walk · ${formatDistance(routePlan.legs[index - 1].distanceMeters)}`
                        : stop.walk}
                  </p>
                </div>
                {stop.isMustGo ? (
                  <span className="must-go-lock" aria-label={`${stop.name} is a must-go place`}>★</span>
                ) : (
                  <button className="swap-button" onClick={(event) => { event.stopPropagation(); replaceStop(stop.id); }} aria-label={`Replace ${stop.name}`}>↻</button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-day">
            <span>✦</span>
            <h2>This day is yours</h2>
            <p>Add another must-go or let Roamly suggest a nearby place.</p>
            <button onClick={openTripSetup}>Adjust this trip</button>
          </div>
        )}

      </section>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <button className="active"><span>⌖</span>Explore</button>
        <button onClick={openTripSetup}><span>▣</span>Trips</button>
        <button onClick={() => setAiOpen(true)}><span>✦</span>Ask AI</button>
        <button><span>♡</span>Saved</button>
      </nav>

      {aiOpen && (
        <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="Ask Roamly">
          <button className="overlay-backdrop" onClick={() => setAiOpen(false)} aria-label="Close" />
          <div className="ai-sheet">
            <div className="drag-handle" />
            <button className="close-button" onClick={() => setAiOpen(false)}>×</button>
            <span className="ai-orb">✦</span>
            <span className="eyebrow">ROAMLY AI</span>
            <h2>What feels right now?</h2>
            <p>I’ll use your location, today’s route and your preferences.</p>
            <div className="prompt-chips">
              <button>Find lunch under $15</button>
              <button>Something indoors nearby</button>
              <button>Make today less rushed</button>
            </div>
            <label className="ai-input">
              <input autoFocus placeholder="Ask anything about your trip..." />
              <button aria-label="Send">↑</button>
            </label>
          </div>
        </div>
      )}

      {tripSetupOpen && (
        <TripSetupPanel
          days={tripSetupDraft.dayCount}
          places={singaporePlaces}
          selectedMustGoIds={tripSetupDraft.mustGoPlaceIds}
          onDaysChange={(dayCount) =>
            setTripSetupDraft((current) =>
              createTripSetup(dayCount, current.mustGoPlaceIds),
            )
          }
          onToggleMustGo={(placeId) =>
            setTripSetupDraft((current) =>
              createTripSetup(
                current.dayCount,
                current.mustGoPlaceIds.includes(placeId)
                  ? current.mustGoPlaceIds.filter((id) => id !== placeId)
                  : [...current.mustGoPlaceIds, placeId],
              ),
            )
          }
          onContinue={saveTripSetup}
          onClose={() => setTripSetupOpen(false)}
          isEditing={Boolean(tripSetup)}
          canClose={Boolean(tripSetup)}
        />
      )}

      {tastePanelMode && (
        <TastePanel
          mode={tastePanelMode}
          profile={tasteProfile}
          recommendations={personalizedRecommendations}
          savedPlaceIds={savedPlaceIds}
          onClose={() => setTastePanelMode(null)}
          onEditProfile={() => setTastePanelMode("profile")}
          onSaveProfile={saveTasteProfile}
          onToggleSave={toggleSavedPlace}
          onDismiss={dismissPlace}
        />
      )}
    </main>
  );
}
