# Roamly Product Insights and Development Direction

## 1. Product vision

Roamly is a map-first, AI-assisted travel companion that helps people answer:

> Given who I am, where I am, what I have already done, and what is happening
> right now, what is the best next thing for me?

The product should reduce travel decision fatigue before and during a trip. It
should not behave like another directory of popular places. It should produce
small, practical, explainable choices that fit the user and the situation.

The long-term product loop is:

```text
Discover → Plan on a map → Travel → Adapt in real time → Learn preferences
```

## 2. Problem we are solving

Travelers often have access to too much fragmented information but still do not
know what to do next. Current products commonly have these weaknesses:

- Recommendations are driven mainly by popularity and ratings.
- Lists contain too many choices and create more decision fatigue.
- Recommendations do not understand available time, location, weather, budget,
  companions, or the rest of the day's itinerary.
- Planning tools and real-time recommendation tools are disconnected.
- Users must repeatedly explain context that the application already knows.
- The same famous attractions are suggested to everyone, including returning
  visitors and local residents.

Roamly should turn context into a feasible decision, not just return search
results.

## 3. Initial audience and market

The first market is Singapore. It is geographically compact, dense with food
and activities, well connected by transit, and suitable for testing both
pre-trip planning and real-time decisions.

The initial audience is independent travelers visiting Singapore for two to
four days. A secondary audience is Singapore residents looking for something
new to do on weekends.

We should start with three connected areas:

- Chinatown and Tanjong Pagar
- Marina Bay
- Bugis and Kampong Glam

This gives the first dataset a useful mix of food, culture, nature, shopping,
and indoor options while keeping routes realistic.

## 4. Core product experiences

### 4.1 Before the trip

The user provides a destination, dates, hotel or starting point, interests,
budget, preferred pace, companions, dietary needs, and any must-visit places.

Roamly creates a visual itinerary directly on the map with:

- Stops grouped into sensible neighborhoods
- An efficient route order
- Estimated travel and visit times
- Meals placed at appropriate times
- Opening-hours and schedule checks
- Expected cost
- Fixed and flexible stops
- Indoor or rainy-day alternatives

The user can remove, reorder, or replace stops and can ask for changes such as:

- “Make day two less busy.”
- “Add a local lunch near this route.”
- “Keep the museum but reorganize everything else.”
- “Avoid places that feel too touristy.”

### 4.2 During the trip

The itinerary becomes dynamic when the trip begins. Roamly considers:

- Current location
- Current time and day
- Time remaining
- Weather
- Whether a place will still be open on arrival
- Actual travel time
- Budget remaining
- The user's current intent or energy level
- Places already visited, skipped, or disliked
- The next fixed commitment

Roamly should detect or let the user report that they are behind schedule, have
changed location, stayed longer than expected, become hungry, or no longer want
the planned activity.

The system should propose a clear adjustment rather than silently changing the
trip:

> You are 40 minutes behind schedule. Move the garden to tomorrow and visit a
> nearby indoor market instead?

### 4.3 “What should I do next?”

This is the most important real-time interaction. The application should return
three deliberately different choices:

1. **Best match** — strongest match for preferences and current context
2. **Easy choice** — nearby, reliable, and low-risk
3. **Something different** — a surprising but plausible local experience

Every recommendation should explain why it was selected:

> Recommended because it is an eight-minute walk, open for another three
> hours, within your budget, sheltered from the rain, and similar to places you
> previously enjoyed.

### 4.4 Trip shape and must-go anchors

Before Roamly fills an itinerary, the traveler should choose the trip length
and identify any non-negotiable places. Trip length controls the number of real
day plans; it should not reveal invented weekday or date labels before actual
dates are collected.

Must-go places are hard planning constraints rather than ordinary preference
signals:

- Every valid must-go appears exactly once.
- It is visibly marked and cannot be silently replaced.
- Anchors are distributed into geographically sensible days.
- Flexible recommendations fill the remaining time without duplicating an
  anchor or another scheduled place.
- Anchor tags influence personalization lightly, while explicit taste and
  experience memories remain stronger signals.

The first prototype supports one to seven days and stores the trip shape in a
versioned local profile so it survives refreshes.

## 5. Experience anchors: personalization from real memories

A strong cold-start signal is a user's own travel experience. Instead of only
asking abstract questions such as “Do you like culture?”, Roamly can ask for
specific places that carry meaning.

Useful onboarding questions include:

- What is a place you loved visiting more than anywhere else?
- What did you like about it?
- What is a place in your own city you enjoy or return to often?
- What place in your city have you wanted to visit but have not visited yet?
- What popular place disappointed you, and why?
- Do you want something similar to a past favorite or something different?

These answers are called **experience anchors**.

### 5.1 Why experience anchors are valuable

A statement such as “I loved the National Gallery” is more informative than a
generic “I like museums,” but the place name alone is not enough. The user may
have loved it because it was quiet, air-conditioned, architecturally
interesting, inexpensive, uncrowded, or connected to an important personal
memory.

Roamly should therefore ask one short follow-up:

> What did you love about it?

Suggested reasons can include:

- Atmosphere
- Food
- Architecture
- History or culture
- Nature
- Local character
- Views
- Quietness
- Social energy
- Family friendliness
- Affordability
- Convenience
- Surprise or novelty

### 5.2 Past favorites versus aspirational places

These signals describe different parts of the user:

- A **past favorite** reveals demonstrated taste.
- A **frequently revisited local place** reveals habits and comfort.
- A **local wishlist place** reveals aspiration and curiosity.
- A **disliked place** reveals boundaries and useful negative preferences.

The recommendation engine should preserve this distinction instead of merging
all named places into one preference list.

### 5.3 Experience-anchor data model

```ts
type ExperienceAnchor = {
  id: string;
  placeName: string;
  city?: string;
  relationship:
    | "loved"
    | "revisit_often"
    | "want_to_visit"
    | "disliked";
  reasons: string[];
  context?: {
    companions?: "solo" | "couple" | "friends" | "family";
    tripType?: string;
    timeOfDay?: string;
  };
  extractedTags: string[];
  confidence: number;
};
```

The original user answer should be retained alongside derived tags so that the
system can explain and revise its interpretation.

### 5.4 Avoiding overfitting

One favorite place should influence recommendations but should not dominate
them. The system must distinguish between:

- “Show me something similar.”
- “Use this to understand my taste, but give me variety.”

It should also avoid assuming that a user wants the same category repeatedly.
For example, loving one museum may indicate a preference for thoughtful,
uncrowded environments rather than a desire to visit museums all day.

The application should occasionally test adjacent interests and learn from
accept, skip, save, replace, and dislike actions.

## 6. Preference model

Roamly builds a preference profile from three sources.

### Explicit preferences

- Interests
- Food and dietary requirements
- Budget
- Preferred pace
- Indoor or outdoor preference
- Crowd and queue tolerance
- Accessibility needs
- Traveling companions

### Experience anchors

- Loved places
- Frequently revisited local places
- Wishlist places
- Disliked experiences
- Reasons associated with each place

### Behavioral learning

- Accepted recommendations
- Replaced or skipped stops
- Saved places
- Completed visits
- “More like this” and “Not for me” feedback
- Reasons such as too far, too expensive, too crowded, or not my style

Onboarding should remain short. Start with three to five questions, then learn
progressively from behavior.

## 7. Recommendation architecture

The system should use structured data and deterministic checks before using AI.

```text
User profile + experience anchors
                ↓
Current location, time, weather, and itinerary
                ↓
Hard feasibility filters
                ↓
Candidate scoring and diversity selection
                ↓
Route and schedule validation
                ↓
AI explanation or structured edit
```

### 7.1 Hard filters

Exclude candidates that are:

- Closed or likely to close before arrival
- Incompatible with dietary or accessibility requirements
- Too far for the available time
- Outside a hard budget limit
- Already visited or explicitly disliked
- Incompatible with current weather when no alternative exists

### 7.2 Initial scoring model

```text
recommendation score =
  explicit preference match
+ experience-anchor similarity
+ current intent match
+ route efficiency
+ opening-hours confidence
+ budget fit
+ quality and data confidence
+ novelty
- crowd or queue penalty
- weather mismatch
- schedule risk
- category repetition
```

A reasonable first weighting is:

```text
25% explicit preference and intent match
20% experience-anchor similarity
20% travel-time and route suitability
10% opening-hours confidence
10% budget match
10% quality and reliability
 5% novelty
```

Weights should eventually be learned from feedback, but a transparent rules
system is sufficient for the MVP.

### 7.3 Diversity after ranking

Returning the three highest raw scores can produce three nearly identical
places. After scoring, apply a diversity step so the final choices differ by
category, distance, atmosphere, or degree of novelty.

## 8. Map-first interface

The map is the product's primary interface. AI is a decision and editing layer,
not a separate chatbot disconnected from the itinerary.

The main view should contain:

- A full-screen interactive map
- Numbered itinerary markers
- Optional route lines (hidden by default during early usability testing)
- A day selector
- A collapsible timeline
- Food, attraction, nature, and saved-place filters
- A location button
- A single, uncluttered entry point for contextual recommendations
- Clear marker states for planned, completed, active, suggested, and at-risk
  stops

Current implementation capabilities include:

- Interactive Singapore map
- Real geographic coordinates
- Selectable markers synchronized with the timeline
- Marker filtering
- Browser geolocation
- Walking-time and distance metadata for itinerary legs
- Stop replacement
- An AI interaction panel
- Experience-anchor taste onboarding
- Three explainable, diversified recommendations
- Local save and dismiss feedback

Interface principle: avoid showing the same AI action in multiple prominent
places. The map search and mobile AI navigation item are sufficient during the
prototype stage. Timeline metadata must distinguish neighborhoods from transit
stations; for example, “Marina Bay area” describes the neighborhood and does
not imply an MRT station.

Map interaction principle: selecting an itinerary stop should highlight its
existing marker without recentering, zooming, or resizing the map. Route lines
are intentionally hidden during early product testing to keep the map visually
quiet; walking time can remain in the timeline as supporting information.

## 9. Place data model

The first curated dataset should contain approximately 30–50 places, growing to
100–200 after the product flow is validated.

```ts
type Place = {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  priceLevel: number;
  typicalDurationMinutes: number;
  indoorOutdoor: "indoor" | "outdoor" | "both";
  tags: string[];
  suitableFor: string[];
  dietaryOptions?: string[];
  accessibility?: string[];
  reservationRequired?: boolean;
  nearestTransitStop?: string;
  openingHours?: unknown;
  qualityScore: number;
  source: string;
  lastVerifiedAt: string;
};
```

Operational facts such as coordinates, opening hours, price, route times, and
business status must come from structured or verified sources. AI should not
invent them.

## 10. API integration order

External APIs should be added one capability at a time.

### Phase 1: routing

Use Singapore OneMap routing to replace straight itinerary lines with actual
walking paths and return distance and estimated time.

```text
Browser → Roamly server endpoint → OneMap → route geometry and summary
```

The OneMap token must remain server-side and must not be committed to source
control or exposed to the browser.

The current straight line should remain as a fallback when routing is
unavailable.

### Phase 2: live place facts

Use a place-data provider to refresh dynamic facts such as:

- Open now and next closing time
- Business status
- Current opening hours
- Price level
- Ratings
- Photos

The curated Roamly dataset should remain the recommendation catalog at first.
External APIs enrich and verify those records rather than defining the entire
product.

### Phase 3: weather and disruption context

Add weather and selected real-time signals only after place and routing data are
reliable.

## 11. Role of AI

AI should perform language and planning tasks that benefit from interpretation:

- Convert natural-language requests into structured constraints
- Explain why a recommendation fits
- Translate user feedback into preference updates
- Propose itinerary edits
- Summarize tradeoffs between alternatives

AI should return structured operations instead of directly mutating the map:

```json
{
  "action": "replace_stop",
  "stopId": 2,
  "requirements": {
    "category": "hawker_centre",
    "priceLevel": 1,
    "maximumTravelMinutes": 15,
    "indoorPreferred": true
  }
}
```

The application validates the operation, selects verified candidates, checks
the route and schedule, and then updates the itinerary.

AI should not independently decide whether a place is open, fabricate a route,
or recommend an unverified business.

## 12. MVP definition

The first complete user journey is:

1. The user chooses one to seven days and marks optional must-go places.
2. The user answers a short preference questionnaire and supplies one or two
   experience anchors.
3. The user selects a Singapore starting location and available time.
4. Roamly generates a populated plan for every selected day.
5. The itinerary appears as numbered stops on a map and timeline, with
   must-go places visibly locked.
6. The user can remove, reorder, or replace flexible stops.
7. The route and schedule recalculate for the active day.
8. During the trip, contextual recommendations return three feasible choices.
9. User feedback updates the preference profile.

Success means a traveler can move from “I do not know what to do” to a credible
plan in under two minutes.

## 13. Development roadmap

### Milestone 1 — map prototype

- Mobile-first map and itinerary interface
- Seed Singapore stops
- Marker and timeline synchronization
- Basic filters and geolocation

Status: implemented.

### Milestone 2 — real routes

- Secure OneMap server integration
- Walking route geometry
- Distance and duration per itinerary leg
- API error and fallback handling

Status: integration implemented; awaiting local and hosted OneMap credentials.

### Milestone 3 — curated place catalog

- Define and validate the place schema
- Add 30–50 places across the first three areas
- Add source and verification metadata
- Add suitability and atmosphere tags

Status: initial 24-place Singapore seed implemented across culture, food,
nature, design, and view categories. Expand and add verification metadata after
the recommendation flow is validated.

### Milestone 4 — personalization

- Experience-anchor onboarding
- Preference profile
- Hard feasibility filters
- Transparent scoring
- Diverse three-choice results

Status: deterministic prototype implemented. Profiles and save/dismiss feedback
are stored locally. Both favorite-place qualities and the qualities that appeal
to someone about a place near home feed the taste model. Proximity uses browser
location after the user explicitly enables it, otherwise the selected itinerary
stop is the context. Feasibility signals such as opening hours and weather are
the next layer.

### Milestone 5 — multi-day trip construction

- One-to-seven-day setup
- Searchable must-go place selection
- Hard-anchor distribution and geographic day clustering
- Populated day tabs without duplicate places
- Versioned local trip persistence

Status: implemented as a deterministic prototype. Must-go anchors appear once,
cannot be replaced, and act as a light reference signal for recommendations.

### Milestone 6 — live place facts

- Opening-hours and business-status integration
- Caching and stale-data handling
- “Open on arrival” checks

### Milestone 7 — AI assistance

- Natural-language constraint extraction
- Structured itinerary operations
- Recommendation explanations
- Feedback interpretation

### Milestone 8 — validation

Test with at least five traveler profiles:

- Budget solo traveler
- Food-focused couple
- Family with children
- Older traveler who prefers a slower pace
- Returning visitor avoiding famous attractions

## 14. Product metrics

Early validation should measure:

- Time required to reach an accepted itinerary
- Percentage of recommendations accepted
- Replacement rate and replacement reason
- Percentage of accepted “What next?” suggestions
- Route feasibility failures
- Repeat use during the same trip
- User confidence in the recommendation explanation
- Whether experience anchors improve acceptance compared with generic
  onboarding alone

## 15. Immediate next action

The next implementation action is to make each generated day feasible in the
real world:

1. Collect actual travel dates and a hotel or daily starting point.
2. Add current opening hours and temporary closure status.
3. Enforce a daily time budget that includes visits, meals, and travel.
4. Let users move a must-go place to a different day explicitly.
5. Activate OneMap credentials and verify walking times for every active day.
6. Explain whether each flexible stop matches taste or sits near a must-go.
