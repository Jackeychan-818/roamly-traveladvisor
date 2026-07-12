"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map, Marker } from "maplibre-gl";

export type MapStop = {
  id: number;
  name: string;
  type: "sight" | "food" | "nature";
  latitude: number;
  longitude: number;
};

type SingaporeMapProps = {
  stops: MapStop[];
  visibleStopIds: number[];
  activeStopId: number;
  locateRequest: number;
  onSelectStop: (id: number) => void;
  onLocationStatus: (status: "loading" | "found" | "error") => void;
};

const rasterStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function routeData(stops: MapStop[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: stops.map((stop) => [stop.longitude, stop.latitude]),
    },
  };
}

export default function SingaporeMap({
  stops,
  visibleStopIds,
  activeStopId,
  locateRequest,
  onSelectStop,
  onLocationStatus,
}: SingaporeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterStyle,
      center: [103.852, 1.291],
      zoom: 13.2,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      map.addSource("itinerary-route", {
        type: "geojson",
        data: routeData(stops),
      });
      map.addLayer({
        id: "itinerary-route-shadow",
        type: "line",
        source: "itinerary-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(255, 255, 255, 0.92)",
          "line-width": 8,
        },
      });
      map.addLayer({
        id: "itinerary-route-line",
        type: "line",
        source: "itinerary-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#1f6b57",
          "line-width": 4,
          "line-dasharray": [1.4, 1.4],
        },
      });
      setReady(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const source = mapRef.current.getSource("itinerary-route") as
      | GeoJSONSource
      | undefined;
    source?.setData(routeData(stops));
  }, [ready, stops]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());

    markersRef.current = stops
      .filter((stop) => visibleStopIds.includes(stop.id))
      .map((stop) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `real-map-pin pin-${stop.type}${
          stop.id === activeStopId ? " is-active" : ""
        }`;
        const label = document.createElement("span");
        label.textContent = String(stop.id);
        button.appendChild(label);
        button.setAttribute("aria-label", `${stop.id}. ${stop.name}`);
        button.addEventListener("click", () => onSelectStop(stop.id));

        return new maplibregl.Marker({ element: button, anchor: "bottom" })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(mapRef.current!);
      });
  }, [activeStopId, onSelectStop, ready, stops, visibleStopIds]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const activeStop = stops.find((stop) => stop.id === activeStopId);
    if (!activeStop) return;

    mapRef.current.easeTo({
      center: [activeStop.longitude, activeStop.latitude],
      zoom: 14.2,
      duration: 650,
      essential: true,
    });
  }, [activeStopId, ready, stops]);

  useEffect(() => {
    if (!ready || !mapRef.current || locateRequest === 0) return;

    if (!navigator.geolocation) {
      onLocationStatus("error");
      return;
    }

    onLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mapRef.current) return;

        userMarkerRef.current?.remove();
        const marker = document.createElement("div");
        marker.className = "real-user-location";
        marker.setAttribute("aria-label", "Your current location");

        userMarkerRef.current = new maplibregl.Marker({ element: marker })
          .setLngLat([coords.longitude, coords.latitude])
          .addTo(mapRef.current);

        mapRef.current.easeTo({
          center: [coords.longitude, coords.latitude],
          zoom: 14.5,
          duration: 800,
          essential: true,
        });
        onLocationStatus("found");
      },
      () => onLocationStatus("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [locateRequest, onLocationStatus, ready]);

  return <div ref={containerRef} className="singapore-map" />;
}
