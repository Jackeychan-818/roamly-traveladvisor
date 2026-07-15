import type { PlaceTag, SingaporePlace } from "../personalization/types";

export const tripDayOptions = [1, 2, 3, 4, 5, 6, 7] as const;

export type TripDayCount = (typeof tripDayOptions)[number];

export type TripSetup = {
  dayCount: TripDayCount;
  mustGoPlaceIds: string[];
};

export type TripDayPlan = {
  dayNumber: number;
  anchors: SingaporePlace[];
  areas: string[];
  estimatedVisitMinutes: number;
};

export type MustGoTripPlan = {
  setup: TripSetup;
  days: TripDayPlan[];
  selectedAnchors: SingaporePlace[];
  unknownPlaceIds: string[];
};

export type AnchorTasteSignals = {
  tags: PlaceTag[];
  anchorCount: number;
};

export type TripStopSource = "must-go" | "recommended";

export type TripItineraryStop = {
  place: SingaporePlace;
  source: TripStopSource;
};

export type TripItineraryDay = {
  dayNumber: number;
  stops: TripItineraryStop[];
};

export type FullTripItinerary = {
  setup: TripSetup;
  days: TripItineraryDay[];
  unknownPlaceIds: string[];
};
