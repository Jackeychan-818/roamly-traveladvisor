import type { Metadata } from "next";
import TravelApp from "./TravelApp";

export const metadata: Metadata = {
  title: "Roamly — Singapore, planned around you",
  description:
    "A map-first, AI-assisted travel planner for discovering Singapore your way.",
};

export default function Home() {
  return <TravelApp />;
}
