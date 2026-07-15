import assert from "node:assert/strict";
import test from "node:test";

import { singaporePlaces } from "../app/data/places";
import {
  buildTripItinerary,
  createTripSetup,
  getAnchorTasteTags,
} from "../app/trip";

const stopIds = (trip: ReturnType<typeof buildTripItinerary>) =>
  trip.days.flatMap((day) => day.stops.map((stop) => stop.place.id));

test("normalizes trip length and duplicate must-go IDs", () => {
  const setup = createTripSetup(12, [
    "merlion-park",
    "merlion-park",
    "maxwell-food-centre",
  ]);

  assert.equal(setup.dayCount, 7);
  assert.deepEqual(setup.mustGoPlaceIds, [
    "merlion-park",
    "maxwell-food-centre",
  ]);
});

test("builds seven populated days without duplicate places", () => {
  const setup = createTripSetup(7);
  const first = buildTripItinerary(singaporePlaces, setup);
  const second = buildTripItinerary(singaporePlaces, setup);
  const ids = stopIds(first);

  assert.equal(first.days.length, 7);
  assert.ok(first.days.every((day) => day.stops.length > 0));
  assert.ok(first.days.every((day) => day.stops.length <= 4));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, stopIds(second), "generation should be deterministic");
});

test("includes every valid must-go exactly once and locks its source", () => {
  const mustGoPlaceIds = [
    "gardens-by-the-bay-supertree-grove",
    "singapore-botanic-gardens",
    "jewel-rain-vortex",
    "maxwell-food-centre",
  ];
  const trip = buildTripItinerary(
    singaporePlaces,
    createTripSetup(3, [...mustGoPlaceIds, mustGoPlaceIds[0]]),
    getAnchorTasteTags(singaporePlaces, mustGoPlaceIds),
  );
  const allStops = trip.days.flatMap((day) => day.stops);

  mustGoPlaceIds.forEach((id) => {
    const matches = allStops.filter((stop) => stop.place.id === id);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].source, "must-go");
  });
  assert.equal(new Set(stopIds(trip)).size, stopIds(trip).length);
});

test("preserves anchors when one day exceeds the soft four-stop limit", () => {
  const mustGoPlaceIds = singaporePlaces.slice(0, 6).map((place) => place.id);
  const trip = buildTripItinerary(
    singaporePlaces,
    createTripSetup(1, mustGoPlaceIds),
  );

  assert.equal(trip.days.length, 1);
  assert.equal(trip.days[0].stops.length, 6);
  assert.deepEqual(
    new Set(trip.days[0].stops.map((stop) => stop.place.id)),
    new Set(mustGoPlaceIds),
  );
  assert.ok(trip.days[0].stops.every((stop) => stop.source === "must-go"));
});
