export const tasteReasonOptions = [
  "quiet",
  "architecture",
  "food",
  "nature",
  "culture",
  "views",
  "local",
  "lively",
] as const;

export const interestOptions = [
  "culture",
  "food",
  "nature",
  "design",
  "views",
  "local life",
] as const;

export type TasteReason = (typeof tasteReasonOptions)[number];
export type Interest = (typeof interestOptions)[number];
export type TravelPace = "slow" | "balanced" | "packed";
export type BudgetPreference = "free" | "value" | "flexible";

export type TasteProfile = {
  favoritePlace: string;
  reasons: TasteReason[];
  localPlace: string;
  localRelationship: "love" | "want";
  localReasons: TasteReason[];
  interests: Interest[];
  pace: TravelPace;
  budget: BudgetPreference;
};

export type PlaceTag =
  | TasteReason
  | Interest
  | "family"
  | "hidden-gem";

export type SingaporePlace = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  category: "culture" | "food" | "nature" | "design" | "view";
  priceLevel: 0 | 1 | 2 | 3;
  typicalDurationMinutes: number;
  indoorOutdoor: "indoor" | "outdoor" | "both";
  tags: PlaceTag[];
  summary: string;
  nearestMrt: string;
};

export type RecommendationLabel =
  | "Best match"
  | "Easy choice"
  | "Something different";

export type PlaceRecommendation = {
  label: RecommendationLabel;
  place: SingaporePlace;
  reason: string;
  score: number;
};

export const emptyTasteProfile: TasteProfile = {
  favoritePlace: "",
  reasons: [],
  localPlace: "",
  localRelationship: "love",
  localReasons: [],
  interests: ["culture"],
  pace: "balanced",
  budget: "value",
};
