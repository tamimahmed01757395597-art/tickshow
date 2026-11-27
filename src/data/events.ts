export type EventCategory =
  | "Concerts & Music"
  | "Sports"
  | "Festivals"
  | "Theatre"
  | "Technology"
  | "Workshops"
  | "Business Events"
  | "Other Experiences";

export type EventLineupItem = {
  name: string;
  role: string;
};

export type TickShowEvent = {
  id: string;
  title: string;
  category: EventCategory;
  date: string;
  dateValue: string;
  time: string;
  venue: string;
  location: string;
  city: string;
  price: number;
  status: string;
  image: string;
  imageAlt: string;
  about: string;
  lineup: EventLineupItem[];
};

export const EVENT_CATEGORIES: EventCategory[] = [
  "Concerts & Music",
  "Sports",
  "Festivals",
  "Theatre",
  "Technology",
  "Workshops",
  "Business Events",
  "Other Experiences",
];
