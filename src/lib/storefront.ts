import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { EventCategory, EventLineupItem, TickShowEvent } from "../data/events";
import type { Database } from "../types/database";

type ShowcaseRow = Database["public"]["Tables"]["storefront_events"]["Row"];
type ShowcaseGroup = Database["public"]["Enums"]["storefront_event_group"];

export type StorefrontEvent = TickShowEvent & {
  showcaseGroup: ShowcaseGroup;
  isCarousel: boolean;
  carouselOrder: number;
  displayOrder: number;
  isVisible: boolean;
  recordId: string;
};

function toLineup(value: ShowcaseRow["lineup"]): EventLineupItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { name: string; role?: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { name?: unknown }).name === "string",
    )
    .map((item) => ({ name: item.name, role: item.role ?? "" }));
}

function mapRow(row: ShowcaseRow): StorefrontEvent {
  return {
    id: row.slug,
    title: row.title,
    category: row.category as EventCategory,
    date: row.date_label,
    dateValue: row.date_value,
    time: row.time_label ?? "",
    venue: row.venue ?? "",
    location: row.location ?? "",
    city: row.city ?? "",
    price: Number(row.price_amount),
    status: row.status_label,
    image: row.image_url ?? "",
    imageAlt: row.image_alt ?? "",
    about: row.about ?? "",
    lineup: toLineup(row.lineup),
    showcaseGroup: row.event_group,
    isCarousel: row.is_carousel,
    carouselOrder: row.carousel_order,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
    recordId: row.id,
  };
}

export async function fetchStorefrontEvents(): Promise<StorefrontEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("storefront_events")
    .select("*")
    .eq("is_visible", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export function useStorefrontEvents() {
  const [events, setEvents] = useState<StorefrontEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    setLoading(true);
    fetchStorefrontEvents()
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Could not load events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { events, loading, error };
}
