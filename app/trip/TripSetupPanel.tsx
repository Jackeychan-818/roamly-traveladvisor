"use client";

import { useId, useMemo, useState } from "react";
import type { SingaporePlace } from "../personalization/types";
import { getFeaturedMustGoPlaces } from "./planner";

export type TripSetupPanelProps = {
  days: number;
  places: SingaporePlace[];
  selectedMustGoIds: string[];
  onDaysChange: (days: number) => void;
  onToggleMustGo: (placeId: string) => void;
  onContinue: () => void;
  onClose: () => void;
  isEditing?: boolean;
  canClose?: boolean;
};

type PlaceCategory = SingaporePlace["category"];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const FEATURED_LIMIT = 8;

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (character) => character.toUpperCase());

export default function TripSetupPanel({
  days,
  places,
  selectedMustGoIds,
  onDaysChange,
  onToggleMustGo,
  onContinue,
  onClose,
  isEditing = false,
  canClose = true,
}: TripSetupPanelProps) {
  const titleId = useId();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | PlaceCategory>("all");

  const safeDays = Math.min(7, Math.max(1, days));
  const selectedIds = useMemo(
    () => new Set(selectedMustGoIds),
    [selectedMustGoIds],
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(places.map((place) => place.category))).sort() as PlaceCategory[],
    [places],
  );
  const featuredOrder = useMemo(
    () =>
      new Map(
        getFeaturedMustGoPlaces(places, places.length).map((place, index) => [
          place.id,
          index,
        ]),
      ),
    [places],
  );

  const matchingPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return places
      .filter((place) => {
        const matchesCategory = category === "all" || place.category === category;
        const searchableText = `${place.name} ${place.area} ${place.category}`.toLocaleLowerCase();
        return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
      })
      .sort((left, right) => {
        const selectionDifference =
          Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
        if (selectionDifference) return selectionDifference;
        if (!normalizedQuery && category === "all") {
          return (featuredOrder.get(left.id) ?? 0) - (featuredOrder.get(right.id) ?? 0);
        }
        return left.name.localeCompare(right.name);
      });
  }, [category, featuredOrder, places, query, selectedIds]);

  const visiblePlaces = matchingPlaces.slice(0, FEATURED_LIMIT);
  const selectedCount = selectedMustGoIds.length;
  const selectedLabel = `${selectedCount} must-go ${selectedCount === 1 ? "place" : "places"}`;
  const selectedVisitMinutes = places
    .filter((place) => selectedIds.has(place.id))
    .reduce((total, place) => total + place.typicalDurationMinutes, 0);
  const isOverloaded = selectedVisitMinutes > safeDays * 360;

  return (
    <div
      className="trip-setup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {canClose ? (
        <button
          className="trip-setup-backdrop"
          type="button"
          onClick={onClose}
          aria-label="Close trip setup"
        />
      ) : (
        <div className="trip-setup-backdrop" aria-hidden="true" />
      )}

      <section className="trip-setup-sheet">
        <div className="drag-handle" aria-hidden="true" />
        {canClose && (
          <button
            className="close-button trip-setup-close"
            type="button"
            onClick={onClose}
            aria-label="Close trip setup"
          >
            ×
          </button>
        )}

        <header className="trip-setup-header">
          <span className="taste-orb trip-setup-orb" aria-hidden="true">✦</span>
          <span className="eyebrow">BUILD AROUND WHAT MATTERS</span>
          <h2 id={titleId}>{isEditing ? "Adjust your trip" : "Start with your trip shape"}</h2>
          <p className="trip-setup-intro">
            Tell us how long you have and which places are non-negotiable. We&apos;ll plan the rest around them.
          </p>
        </header>

        <fieldset className="trip-setup-fieldset trip-setup-duration">
          <legend>How many days in Singapore?</legend>
          <div className="trip-day-options">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day}
                type="button"
                className={safeDays === day ? "selected" : ""}
                aria-pressed={safeDays === day}
                onClick={() => onDaysChange(day)}
              >
                <strong>{day}</strong>
                <span>{day === 1 ? "day" : "days"}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <section className="trip-must-go-section" aria-labelledby={`${titleId}-must-go`}>
          <div className="trip-must-go-heading">
            <div>
              <h3 id={`${titleId}-must-go`}>Your must-go places</h3>
              <p>Choose the sights you definitely want included. This step is optional.</p>
            </div>
            <span className="trip-selected-count" aria-live="polite">{selectedLabel}</span>
          </div>
          {isOverloaded && (
            <p className="trip-setup-warning" role="status">
              This is a very packed must-go list—more than six hours of visits per day before meals and travel.
            </p>
          )}

          <label className="trip-place-search" htmlFor={searchId}>
            <span className="sr-only">Search Singapore places</span>
            <span className="trip-place-search-icon" aria-hidden="true">⌕</span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by place, area, or category"
              autoComplete="off"
            />
          </label>

          <div className="trip-category-filters" aria-label="Filter places by category">
            <button
              type="button"
              className={category === "all" ? "selected" : ""}
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              All
            </button>
            {categories.map((placeCategory) => (
              <button
                key={placeCategory}
                type="button"
                className={category === placeCategory ? "selected" : ""}
                aria-pressed={category === placeCategory}
                onClick={() => setCategory(placeCategory)}
              >
                {titleCase(placeCategory)}
              </button>
            ))}
          </div>

          {visiblePlaces.length ? (
            <>
              <div className="trip-place-grid" aria-label="Featured Singapore places">
                {visiblePlaces.map((place) => {
                  const isSelected = selectedIds.has(place.id);
                  return (
                    <button
                      className={`trip-place-card ${isSelected ? "selected" : ""}`}
                      type="button"
                      key={place.id}
                      onClick={() => onToggleMustGo(place.id)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Remove" : "Add"} ${place.name} ${isSelected ? "from" : "to"} must-go places`}
                    >
                      <span className="trip-place-card-copy">
                        <strong>{place.name}</strong>
                        <span>{place.area} · {titleCase(place.category)}</span>
                      </span>
                      <span className="trip-place-check" aria-hidden="true">
                        {isSelected ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {matchingPlaces.length > visiblePlaces.length && (
                <p className="trip-place-result-note">
                  Showing {visiblePlaces.length} of {matchingPlaces.length} matches. Refine your search to find a specific place.
                </p>
              )}
            </>
          ) : (
            <div className="trip-place-empty" role="status">
              <strong>No places found</strong>
              <span>Try another name, area, or category.</span>
            </div>
          )}
        </section>

        <footer className="trip-setup-footer">
          <span>{safeDays} {safeDays === 1 ? "day" : "days"} · {selectedLabel}</span>
          <button className="taste-primary trip-setup-primary" type="button" onClick={onContinue}>
            {isEditing ? "Update trip" : "Build my trip"}
          </button>
        </footer>
      </section>
    </div>
  );
}
