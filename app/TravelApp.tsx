"use client";

import { useEffect, useMemo, useState } from "react";
import SingaporeMap from "./SingaporeMap";

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

type RouteStatus =
  | "loading"
  | "live"
  | "partial"
  | "setup"
  | "error";

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
  },
];

const alternatives: Record<number, Pick<Stop, "name" | "area" | "type" | "duration" | "note" | "latitude" | "longitude">> = {
  1: { name: "Singapore City Gallery", area: "Tanjong Pagar", type: "sight", duration: "60 min", latitude: 1.2797, longitude: 103.8451, note: "Air-conditioned, free, and a smart introduction to how Singapore grew." },
  2: { name: "Amoy Street Food Centre", area: "Telok Ayer", type: "food", duration: "75 min", latitude: 1.2793, longitude: 103.8466, note: "A more workday-local hawker stop with plenty of budget choices." },
  3: { name: "ArtScience Museum", area: "Marina Bay", type: "sight", duration: "2 hr", latitude: 1.2863, longitude: 103.8593, note: "A fully indoor alternative that keeps the rest of your route intact." },
  4: { name: "National Gallery Singapore", area: "Civic District", type: "sight", duration: "90 min", latitude: 1.2906, longitude: 103.8514, note: "A slower indoor finish with Southeast Asian art and city views." },
};

const filters = [
  ["all", "All"],
  ["food", "Eat"],
  ["sight", "Explore"],
  ["nature", "Outdoors"],
] as const;

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export default function TravelApp() {
  const [stops, setStops] = useState(initialStops);
  const [activeStop, setActiveStop] = useState(1);
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [day, setDay] = useState(1);
  const [locateRequest, setLocateRequest] = useState(0);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [aiOpen, setAiOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>("loading");

  const visibleStops = useMemo(
    () => stops.filter((stop) => filter === "all" || stop.type === filter),
    [filter, stops],
  );
  const visibleStopIds = useMemo(
    () => visibleStops.map((stop) => stop.id),
    [visibleStops],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadWalkingRoutes() {
      setRouteStatus("loading");

      try {
        const response = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stops: stops.map(({ id, latitude, longitude }) => ({
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
          setRoutePlan(null);
          setRouteStatus(
            "code" in payload && payload.code === "routing_not_configured"
              ? "setup"
              : "error",
          );
          return;
        }

        const plan = payload as RoutePlan;
        setRoutePlan(plan);
        setRouteStatus(plan.hasFallback ? "partial" : "live");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRoutePlan(null);
        setRouteStatus("error");
      }
    }

    loadWalkingRoutes();
    return () => controller.abort();
  }, [stops]);

  const replaceStop = (id: number) => {
    setStops((current) =>
      current.map((stop) =>
        stop.id === id ? { ...stop, ...alternatives[id] } : stop,
      ),
    );
  };

  const active = stops.find((stop) => stop.id === activeStop) ?? stops[0];

  return (
    <main className="app-shell">
      <section className="map-panel" aria-label="Singapore itinerary map">
        <SingaporeMap
          stops={stops}
          visibleStopIds={visibleStopIds}
          activeStopId={activeStop}
          routeCoordinates={routePlan?.coordinates}
          routeIsLive={routeStatus === "live"}
          locateRequest={locateRequest}
          onSelectStop={setActiveStop}
          onLocationStatus={setLocationStatus}
        />

        <div className={`route-status route-${routeStatus}`} aria-live="polite">
          <span />
          {routeStatus === "loading"
            ? "Calculating walking routes..."
            : routeStatus === "live"
              ? "Live OneMap walking routes"
              : routeStatus === "partial"
                ? "Some walking legs are estimated"
                : routeStatus === "setup"
                  ? "Add OneMap access for live routes"
                  : "Walking routes unavailable"}
        </div>

        <header className="topbar">
          <a className="brand" href="#" aria-label="Roamly home">
            <span className="brand-mark">R</span>
            <span>roamly</span>
          </a>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setSaved(!saved)} aria-label="Save trip">
              {saved ? "♥" : "♡"}
            </button>
            <button className="avatar" aria-label="Open profile">JC</button>
          </div>
        </header>

        <div className="search-wrap">
          <button className="search-box" onClick={() => setAiOpen(true)}>
            <span className="spark">✦</span>
            <span>Ask Roamly to change your plan...</span>
            <kbd>AI</kbd>
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
          <button onClick={() => replaceStop(active.id)}>Find another like this</button>
        </aside>
      </section>

      <section className="plan-panel">
        <div className="drag-handle" />
        <div className="plan-heading">
          <div>
            <span className="eyebrow">YOUR SINGAPORE TRIP</span>
            <h1>A day made for you</h1>
          </div>
          <button className="more-button" aria-label="More trip options">•••</button>
        </div>

        <div className="day-tabs" role="tablist" aria-label="Trip days">
          {[1, 2, 3].map((number) => (
            <button key={number} role="tab" aria-selected={day === number} className={day === number ? "active" : ""} onClick={() => setDay(number)}>
              <small>{number === 1 ? "TODAY" : number === 2 ? "MON" : "TUE"}</small>
              <strong>{number === 1 ? "12" : number === 2 ? "13" : "14"}</strong>
            </button>
          ))}
          <button className="add-day" aria-label="Add a day">＋</button>
        </div>

        {day === 1 ? (
          <div className="timeline">
            {stops.map((stop, index) => (
              <article className={`stop-row ${activeStop === stop.id ? "active" : ""}`} key={stop.id} onClick={() => setActiveStop(stop.id)}>
                <div className="timeline-track">
                  <span className={`timeline-dot dot-${stop.type}`}>{stop.id}</span>
                  {index < stops.length - 1 && <span className="connector" />}
                </div>
                <div className="stop-content">
                  <div className="stop-time">{stop.time} <span>· {stop.duration}</span></div>
                  <h3>{stop.name}</h3>
                  <p>
                    {stop.area} <span>•</span>{" "}
                    {index === 0
                      ? "Start here"
                      : routePlan?.legs[index - 1]
                        ? `${routePlan.legs[index - 1].source === "fallback" ? "~" : ""}${Math.max(1, Math.round(routePlan.legs[index - 1].durationSeconds / 60))} min walk · ${formatDistance(routePlan.legs[index - 1].distanceMeters)}`
                        : stop.walk}
                  </p>
                </div>
                <button className="swap-button" onClick={(event) => { event.stopPropagation(); replaceStop(stop.id); }} aria-label={`Replace ${stop.name}`}>↻</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-day">
            <span>✦</span>
            <h2>This day is yours</h2>
            <p>Tell Roamly your mood and we’ll build a route around it.</p>
            <button onClick={() => setAiOpen(true)}>Plan day {day} with AI</button>
          </div>
        )}

        <button className="next-button" onClick={() => setAiOpen(true)}>
          <span className="spark-circle">✦</span>
          <span><strong>What should I do next?</strong><small>3 ideas that fit your location and mood</small></span>
          <span className="chevron">›</span>
        </button>
      </section>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <button className="active"><span>⌖</span>Explore</button>
        <button><span>▣</span>Trips</button>
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
    </main>
  );
}
