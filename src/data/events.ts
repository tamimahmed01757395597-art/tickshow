export type EventCategory =
  | "Concerts & Music"
  | "Sports"
  | "Festivals"
  | "Theatre"
  | "Technology"
  | "Workshops"
  | "Business Events"
  | "Other Experiences";

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

export const TICKSHOW_EVENTS: TickShowEvent[] = [
  {
    id: "rooftop-frequencies",
    title: "Rooftop Frequencies",
    category: "Concerts & Music",
    date: "Saturday, July 25, 2026",
    dateValue: "2026-07-25",
    time: "Doors at 7:00 PM",
    venue: "Elsewhere Rooftop",
    location: "Brooklyn, NY",
    city: "New York City",
    price: 48,
    status: "Selling fast",
    image:
      "https://images.pexels.com/photos/14870726/pexels-photo-14870726.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A huge festival crowd facing a live stage at night",
  },
  {
    id: "liberty-aces",
    title: "New York Liberty vs. Las Vegas Aces",
    category: "Sports",
    date: "Friday, August 7, 2026",
    dateValue: "2026-08-07",
    time: "Tip-off at 7:00 PM",
    venue: "Barclays Center",
    location: "Brooklyn, NY",
    city: "New York City",
    price: 39,
    status: "Tickets moving",
    image:
      "https://images.pexels.com/photos/31169234/pexels-photo-31169234.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A basketball player rising for a dunk under arena lights",
  },
  {
    id: "afterglow-festival",
    title: "Afterglow City Festival",
    category: "Festivals",
    date: "August 14-16, 2026",
    dateValue: "2026-08-14",
    time: "Gates open at 2:00 PM",
    venue: "Randall's Island Park",
    location: "Randall's Island, NY",
    city: "New York City",
    price: 125,
    status: "Early bird",
    image:
      "https://images.pexels.com/photos/40755879/pexels-photo-40755879.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A busy night street festival glowing with food and market stalls",
  },
  {
    id: "midsummer-night",
    title: "A Midsummer Night's Dream",
    category: "Theatre",
    date: "Thursday, August 20, 2026",
    dateValue: "2026-08-20",
    time: "Curtain at 7:30 PM",
    venue: "The Joyce Theater",
    location: "Manhattan, NY",
    city: "New York City",
    price: 42,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/8820330/pexels-photo-8820330.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A dancer performing under a focused stage spotlight",
  },
  {
    id: "future-form",
    title: "Future / Form 2026",
    category: "Technology",
    date: "Saturday, September 5, 2026",
    dateValue: "2026-09-05",
    time: "Doors at 10:00 AM",
    venue: "Brooklyn Navy Yard",
    location: "Brooklyn, NY",
    city: "New York City",
    price: 65,
    status: "Limited tickets",
    image:
      "https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "An audience watching a speaker at a large indoor conference",
  },
  {
    id: "clay-after-hours",
    title: "Clay After Hours",
    category: "Workshops",
    date: "Saturday, September 12, 2026",
    dateValue: "2026-09-12",
    time: "Workshop begins at 6:00 PM",
    venue: "Brooklyn Clay",
    location: "Brooklyn, NY",
    city: "New York City",
    price: 55,
    status: "A few places left",
    image:
      "https://images.pexels.com/photos/6023597/pexels-photo-6023597.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "People shaping pottery together in a hands-on workshop",
  },
  {
    id: "good-city-summit",
    title: "Good City Summit",
    category: "Business Events",
    date: "Thursday, September 17, 2026",
    dateValue: "2026-09-17",
    time: "Doors at 9:00 AM",
    venue: "Spring Studios",
    location: "Manhattan, NY",
    city: "New York City",
    price: 89,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/15448073/pexels-photo-15448073.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A packed conference hall listening to a live presentation",
  },
  {
    id: "sunday-plates",
    title: "Sunday Plates: Night Market",
    category: "Other Experiences",
    date: "Sunday, October 4, 2026",
    dateValue: "2026-10-04",
    time: "Market opens at 2:00 PM",
    venue: "Industry City",
    location: "Brooklyn, NY",
    city: "New York City",
    price: 22,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/41156914/pexels-photo-41156914.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "An overhead view of a lively market with food stalls and visitors",
  },
];