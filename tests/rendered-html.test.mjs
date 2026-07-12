import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps itinerary pins fixed when a stop is selected", async () => {
  const [map, css] = await Promise.all([
    source("app/SingaporeMap.tsx"),
    source("app/globals.css"),
  ]);

  assert.doesNotMatch(map, /GeoJSONSource|itinerary-route|routeCoordinates/);
  assert.equal(
    (map.match(/\.easeTo\(/g) ?? []).length,
    1,
    "Only the explicit Use my location action may move the map",
  );

  const activePinRule = css.match(/\.real-map-pin\.is-active\s*\{([^}]+)\}/)?.[1];
  assert.ok(activePinRule, "Expected a visible active-pin treatment");
  assert.doesNotMatch(activePinRule, /scale|transform/);
  assert.match(activePinRule, /box-shadow/);
});

test("ships the Singapore taste-personalization prototype", async () => {
  const [travelApp, panel, recommendationLogic, places] = await Promise.all([
    source("app/TravelApp.tsx"),
    source("app/personalization/TastePanel.tsx"),
    source("app/personalization/recommend.ts"),
    source("app/data/places.ts"),
  ]);

  assert.equal((places.match(/^\s+id: "/gm) ?? []).length, 24);
  assert.match(travelApp, /roamly:taste-profile/);
  assert.match(travelApp, /<TastePanel/);
  assert.match(panel, /Teach Roamly what feels good/);
  assert.match(panel, /Build my recommendations/);
  assert.match(recommendationLogic, /"Best match"/);
  assert.match(recommendationLogic, /"Easy choice"/);
  assert.match(recommendationLogic, /"Something different"/);
  assert.match(recommendationLogic, /normalized === "local life" \? "local"/);
  assert.match(recommendationLogic, /profile\.localReasons/);
  assert.match(travelApp, /onLocationFound=\{setUserLocation\}/);
});
