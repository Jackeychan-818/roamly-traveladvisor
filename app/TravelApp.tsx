"use client";

import { useMemo, useState } from "react";

type Stop = {
  id: number;
  time: string;
  name: string;
  area: string;
  type: "sight" | "food" | "nature";
  duration: string;
  walk: string;
  x: number;
  y: number;
  note: string;
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
    x: 39,
    y: 58,
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
    x: 48,
    y: 68,
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
    x: 72,
    y: 54,
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
    x: 62,
    y: 29,
    note: "Independent shops, street art and an easy golden-hour walk.",
  },
];

const alternatives: Record<number, Pick<Stop, "name" | "area" | "type" | "duration" | "note">> = {
  1: { name: "Singapore City Gallery", area: "Tanjong Pagar", type: "sight", duration: "60 min", note: "Air-conditioned, free, and a smart introduction to how Singapore grew." },
  2: { name: "Amoy Street Food Centre", area: "Telok Ayer", type: "food", duration: "75 min", note: "A more workday-local hawker stop with plenty of budget choices." },
  3: { name: "ArtScience Museum", area: "Marina Bay", type: "sight", duration: "2 hr", note: "A fully indoor alternative that keeps the rest of your route intact." },
  4: { name: "National Gallery Singapore", area: "Civic District", type: "sight", duration: "90 min", note: "A slower indoor finish with Southeast Asian art and city views." },
};

const filters = [
  ["all", "All"],
  ["food", "Eat"],
  ["sight", "Explore"],
  ["nature", "Outdoors"],
] as const;

export default function TravelApp() {
  const [stops, setStops] = useState(initialStops);
  const [activeStop, setActiveStop] = useState(1);
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [day, setDay] = useState(1);
  const [located, setLocated] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const visibleStops = useMemo(
    () => stops.filter((stop) => filter === "all" || stop.type === filter),
    [filter, stops],
  );

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
        <div className="map-grid" />
        <div className="island island-main" />
        <div className="island island-sentosa" />
        <span className="water-label">SINGAPORE STRAIT</span>
        <span className="area-label label-chinatown">Chinatown</span>
        <span className="area-label label-marina">Marina Bay</span>
        <span className="area-label label-bugis">Bugis</span>

        <div className="route-line route-one" />
        <div className="route-line route-two" />
        <div className="route-line route-three" />

        {visibleStops.map((stop) => (
          <button
            className={`map-pin pin-${stop.type} ${activeStop === stop.id ? "is-active" : ""}`}
            key={stop.id}
            style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
            onClick={() => setActiveStop(stop.id)}
            aria-label={`${stop.id}. ${stop.name}`}
          >
            {stop.id}
          </button>
        ))}

        {located && <div className="user-location" aria-label="Your location"><span /></div>}

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

        <button className={`locate-button ${located ? "located" : ""}`} onClick={() => setLocated(!located)}>
          <span className="locate-arrow">⌖</span>
          {located ? "You’re near Chinatown" : "Use my location"}
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
                  <p>{stop.area} <span>•</span> {stop.walk}</p>
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
