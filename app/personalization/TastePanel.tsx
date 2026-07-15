"use client";

import { FormEvent, useState } from "react";
import {
  BudgetPreference,
  emptyTasteProfile,
  interestOptions,
  Interest,
  PlaceRecommendation,
  TasteProfile,
  tasteReasonOptions,
  TasteReason,
  TravelPace,
} from "./types";

type TastePanelProps = {
  mode: "profile" | "recommendations";
  profile: TasteProfile | null;
  recommendations: PlaceRecommendation[];
  savedPlaceIds: string[];
  onClose: () => void;
  onEditProfile: () => void;
  onSaveProfile: (profile: TasteProfile) => void;
  onToggleSave: (placeId: string) => void;
  onDismiss: (placeId: string) => void;
};

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (character) => character.toUpperCase());

const priceLabel = (priceLevel: number) =>
  priceLevel === 0 ? "Free" : "$".repeat(priceLevel);

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export default function TastePanel({
  mode,
  profile,
  recommendations,
  savedPlaceIds,
  onClose,
  onEditProfile,
  onSaveProfile,
  onToggleSave,
  onDismiss,
}: TastePanelProps) {
  const [draft, setDraft] = useState<TasteProfile>(
    profile ?? emptyTasteProfile,
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.favoritePlace.trim() || draft.reasons.length === 0) return;
    onSaveProfile({
      ...draft,
      favoritePlace: draft.favoritePlace.trim(),
      localPlace: draft.localPlace.trim(),
    });
  };

  return (
    <div className="taste-overlay" role="dialog" aria-modal="true" aria-label="Your Roamly taste profile">
      <button className="taste-backdrop" onClick={onClose} aria-label="Close taste profile" />
      <section className="taste-sheet">
        <div className="drag-handle" />
        <button className="close-button" onClick={onClose} aria-label="Close">×</button>

        {mode === "profile" ? (
          <form onSubmit={submit} className="taste-form">
            <span className="taste-orb">✦</span>
            <span className="eyebrow">YOUR TASTE, NOT THE CROWD&apos;S</span>
            <h2>Teach Roamly what feels good</h2>
            <p className="taste-intro">One real memory tells us more than ten generic travel filters.</p>

            <label className="taste-field">
              <span>A place you have loved</span>
              <input
                value={draft.favoritePlace}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, favoritePlace: event.target.value }))
                }
                placeholder="e.g. a quiet temple in Kyoto"
                autoFocus
              />
            </label>

            <fieldset className="taste-fieldset">
              <legend>What made it special?</legend>
              <div className="taste-chips">
                {tasteReasonOptions.map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    className={draft.reasons.includes(reason) ? "selected" : ""}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        reasons: toggleValue<TasteReason>(current.reasons, reason),
                      }))
                    }
                  >
                    {titleCase(reason)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="local-memory-row">
              <label className="taste-field">
                <span>A place near home</span>
                <input
                  value={draft.localPlace}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, localPlace: event.target.value }))
                  }
                  placeholder="A favorite or somewhere on your list"
                />
              </label>
              <div className="segmented compact" aria-label="Relationship to local place">
                {(["love", "want"] as const).map((relationship) => (
                  <button
                    type="button"
                    key={relationship}
                    className={draft.localRelationship === relationship ? "selected" : ""}
                    onClick={() =>
                      setDraft((current) => ({ ...current, localRelationship: relationship }))
                    }
                  >
                    {relationship === "love" ? "I love it" : "Want to go"}
                  </button>
                ))}
              </div>
            </div>

            {draft.localPlace.trim() && (
              <fieldset className="taste-fieldset local-reasons">
                <legend>What appeals to you about it?</legend>
                <div className="taste-chips subtle">
                  {tasteReasonOptions.map((reason) => (
                    <button
                      type="button"
                      key={reason}
                      className={draft.localReasons.includes(reason) ? "selected" : ""}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          localReasons: toggleValue<TasteReason>(current.localReasons, reason),
                        }))
                      }
                    >
                      {titleCase(reason)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="taste-fieldset">
              <legend>Usually drawn to</legend>
              <div className="taste-chips subtle">
                {interestOptions.map((interest) => (
                  <button
                    type="button"
                    key={interest}
                    className={draft.interests.includes(interest) ? "selected" : ""}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        interests: toggleValue<Interest>(current.interests, interest),
                      }))
                    }
                  >
                    {titleCase(interest)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="taste-preferences">
              <fieldset className="taste-fieldset">
                <legend>Your pace</legend>
                <div className="segmented">
                  {(["slow", "balanced", "packed"] as TravelPace[]).map((pace) => (
                    <button
                      type="button"
                      key={pace}
                      className={draft.pace === pace ? "selected" : ""}
                      onClick={() => setDraft((current) => ({ ...current, pace }))}
                    >
                      {titleCase(pace)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="taste-fieldset">
                <legend>Budget</legend>
                <div className="segmented">
                  {(["free", "value", "flexible"] as BudgetPreference[]).map((budget) => (
                    <button
                      type="button"
                      key={budget}
                      className={draft.budget === budget ? "selected" : ""}
                      onClick={() => setDraft((current) => ({ ...current, budget }))}
                    >
                      {titleCase(budget)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              className="taste-primary"
              type="submit"
              disabled={!draft.favoritePlace.trim() || draft.reasons.length === 0}
            >
              Build my recommendations
            </button>
          </form>
        ) : (
          <div className="recommendation-view">
            <span className="taste-orb">✦</span>
            <span className="eyebrow">MADE FROM YOUR TASTE</span>
            <h2>Three ways to explore</h2>
            <p className="taste-intro">
              Because you loved {profile?.favoritePlace || "your favorite place"}
              {profile?.reasons.length ? ` for its ${profile.reasons.slice(0, 2).join(" and ")}.` : "."}
            </p>

            <div className="recommendation-list">
              {recommendations.map(({ label, place, reason }) => {
                const isSaved = savedPlaceIds.includes(place.id);
                return (
                  <article className="recommendation-card" key={`${label}-${place.id}`}>
                    <div className="recommendation-heading">
                      <div>
                        <span className="recommendation-label">{label}</span>
                        <h3>{place.name}</h3>
                      </div>
                      <button
                        className={`recommendation-save ${isSaved ? "saved" : ""}`}
                        onClick={() => onToggleSave(place.id)}
                        aria-label={`${isSaved ? "Remove" : "Save"} ${place.name}`}
                      >
                        {isSaved ? "♥" : "♡"}
                      </button>
                    </div>
                    <p>{place.summary}</p>
                    <div className="recommendation-meta">
                      <span>{place.area} area</span>
                      <span>{place.nearestMrt} MRT</span>
                      <span>~{place.typicalDurationMinutes} min</span>
                      <span>{priceLabel(place.priceLevel)}</span>
                    </div>
                    <div className="recommendation-why">{reason}</div>
                    <button className="not-for-me" onClick={() => onDismiss(place.id)}>
                      Not for me — show another
                    </button>
                  </article>
                );
              })}
            </div>

            <button className="edit-taste" onClick={onEditProfile}>Edit my taste</button>
          </div>
        )}
      </section>
    </div>
  );
}
