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

export const PAST_TICKSHOW_EVENTS: TickShowEvent[] = [
  {
    id: "neon-monsoon",
    title: "Neon Monsoon",
    category: "Concerts & Music",
    date: "Saturday, June 13, 2026",
    dateValue: "2026-06-13",
    time: "Doors at 7:00 PM",
    venue: "Manikganj Town Hall",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 1000,
    status: "Sold out",
    image:
      "https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "Concertgoers raising their hands toward a brightly lit stage",
    about:
      "A rain-soaked night at Manikganj Town Hall with three live acts and a closing DJ set that ran well past midnight.",
    lineup: [
      { name: "Aurora Lane", role: "Headliner" },
      { name: "The Nightshift", role: "Support" },
      { name: "DJ Rumi", role: "Closing set" },
    ],
  },
  {
    id: "manikganj-marathon",
    title: "Manikganj Marathon 2026",
    category: "Sports",
    date: "Sunday, May 24, 2026",
    dateValue: "2026-05-24",
    time: "Start at 6:00 AM",
    venue: "Shibaloy Sports Ground",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 400,
    status: "Sold out",
    image:
      "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "Runners smiling as they make their way through a city marathon",
    about:
      "A city-wide race morning that started at Shibaloy Sports Ground and finished along the Manikganj riverside.",
    lineup: [
      { name: "Open 10K", role: "Race category" },
      { name: "Half marathon", role: "Race category" },
      { name: "Kids dash", role: "Race category" },
    ],
  },
  {
    id: "boishakh-bazaar",
    title: "Pohela Boishakh Bazaar",
    category: "Festivals",
    date: "Tuesday, April 14, 2026",
    dateValue: "2026-04-14",
    time: "Gates open at 10:00 AM",
    venue: "Manikganj Riverside Grounds",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 250,
    status: "Sold out",
    image:
      "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A festival stage lit by pyrotechnics above a packed crowd",
    about:
      "Pohela Boishakh celebrated with folk performers, food stalls and a full day of programming by the river.",
    lineup: [
      { name: "Baul Collective", role: "Folk ensemble" },
      { name: "Shonar Bangla Dhol", role: "Percussion" },
      { name: "Rongin Nach", role: "Dance troupe" },
      { name: "Street Food Row", role: "Vendors" },
    ],
  },
  {
    id: "glass-menagerie",
    title: "The Glass Menagerie",
    category: "Theatre",
    date: "Friday, March 20, 2026",
    dateValue: "2026-03-20",
    time: "Curtain at 7:30 PM",
    venue: "District Cultural Hall",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 450,
    status: "Past event",
    image:
      "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A theatre audience seated in rows under blue stage lighting",
    about:
      "Tennessee Williams' memory play, staged in the round at District Cultural Hall for two sold-out nights.",
    lineup: [
      { name: "Nusrat Jahan", role: "Amanda Wingfield" },
      { name: "Arif Hossain", role: "Tom Wingfield" },
      { name: "Mila Rahman", role: "Laura Wingfield" },
      { name: "Tanvir Alam", role: "Jim O'Connor" },
    ],
  },
  {
    id: "build-night",
    title: "Build Night Dhaka",
    category: "Technology",
    date: "Saturday, February 21, 2026",
    dateValue: "2026-02-21",
    time: "Doors at 6:00 PM",
    venue: "Manikganj Tech Hub",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 700,
    status: "Past event",
    image:
      "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "Team members stacking hands over plans and a laptop",
    about:
      "An evening of short demos and open build tables for Manikganj's makers, designers and developers.",
    lineup: [
      { name: "Sadia Karim", role: "Host" },
      { name: "Rakib Hasan", role: "Demo: local-first apps" },
      { name: "Farah Nower", role: "Demo: hardware for farms" },
    ],
  },
  {
    id: "creative-table",
    title: "Creative Table Meetup",
    category: "Workshops",
    date: "Saturday, January 17, 2026",
    dateValue: "2026-01-17",
    time: "Meetup began at 6:00 PM",
    venue: "Manikganj Art Studio",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 850,
    status: "Past event",
    image:
      "https://images.pexels.com/photos/1267697/pexels-photo-1267697.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A small group chatting around a cafe table",
    about:
      "A relaxed meetup for designers, writers and makers to share what they were working on over coffee.",
    lineup: [
      { name: "Imran Chowdhury", role: "Host" },
      { name: "Priya Sen", role: "Guest: zine making" },
      { name: "Open table", role: "Show and tell" },
    ],
  },
];

export const TICKSHOW_EVENTS: TickShowEvent[] = [
  {
    id: "rooftop-frequencies",
    title: "Rooftop Frequencies",
    category: "Concerts & Music",
    date: "Saturday, July 25, 2026",
    dateValue: "2026-07-25",
    time: "Doors at 7:00 PM",
    venue: "Manikganj Town Hall",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 1200,
    status: "Selling fast",
    image:
      "https://images.pexels.com/photos/14870726/pexels-photo-14870726.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A huge festival crowd facing a live stage at night",
    about:
      "Three acts, one rooftop and the Manikganj skyline behind the stage. Doors open an hour before the first set.",
    lineup: [
      { name: "Aurora Lane", role: "Headliner" },
      { name: "Meghdol Road", role: "Support" },
      { name: "DJ Rumi", role: "Closing set" },
    ],
  },
  {
    id: "liberty-aces",
    title: "Manikganj XI vs. Dhaka United",
    category: "Sports",
    date: "Friday, August 7, 2026",
    dateValue: "2026-08-07",
    time: "Tip-off at 7:00 PM",
    venue: "Shibaloy Sports Ground",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 600,
    status: "Tickets moving",
    image:
      "https://images.pexels.com/photos/31169234/pexels-photo-31169234.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A basketball player rising for a dunk under arena lights",
    about:
      "A cross-city exhibition game under the lights at Shibaloy Sports Ground, with courtside seating on all four sides.",
    lineup: [
      { name: "Manikganj XI", role: "Home side" },
      { name: "Dhaka United", role: "Away side" },
      { name: "Courtside Crew", role: "Halftime show" },
    ],
  },
  {
    id: "afterglow-festival",
    title: "Afterglow City Festival",
    category: "Festivals",
    date: "August 14-16, 2026",
    dateValue: "2026-08-14",
    time: "Gates open at 2:00 PM",
    venue: "Manikganj Riverside Grounds",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 800,
    status: "Early bird",
    image:
      "https://images.pexels.com/photos/40755879/pexels-photo-40755879.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A busy night street festival glowing with food and market stalls",
    about:
      "Three days of music, food and late-night markets on the Manikganj riverside, with a different headliner each night.",
    lineup: [
      { name: "Neon Monsoon", role: "Friday headliner" },
      { name: "The Nightshift", role: "Saturday headliner" },
      { name: "Riverside Collective", role: "Sunday headliner" },
      { name: "Night Market Row", role: "Food and stalls" },
    ],
  },
  {
    id: "midsummer-night",
    title: "A Midsummer Night's Dream",
    category: "Theatre",
    date: "Thursday, August 20, 2026",
    dateValue: "2026-08-20",
    time: "Curtain at 7:30 PM",
    venue: "District Cultural Hall",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 500,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/8820330/pexels-photo-8820330.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A dancer performing under a focused stage spotlight",
    about:
      "Shakespeare's forest comedy played under open sky, with a live string score and a cast of twelve.",
    lineup: [
      { name: "Mila Rahman", role: "Puck" },
      { name: "Arif Hossain", role: "Oberon" },
      { name: "Nusrat Jahan", role: "Titania" },
      { name: "Tanvir Alam", role: "Bottom" },
      { name: "Dhaka String Quartet", role: "Live score" },
    ],
  },
  {
    id: "future-form",
    title: "Future / Form 2026",
    category: "Technology",
    date: "Saturday, September 5, 2026",
    dateValue: "2026-09-05",
    time: "Doors at 10:00 AM",
    venue: "Manikganj Tech Hub",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 1500,
    status: "Limited tickets",
    image:
      "https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "An audience watching a speaker at a large indoor conference",
    about:
      "A one-day conference on products, AI and the tools being built across Bangladesh, with demos between talks.",
    lineup: [
      { name: "Sadia Karim", role: "Opening keynote" },
      { name: "Rakib Hasan", role: "Building local-first software" },
      { name: "Farah Nower", role: "Hardware, farms and data" },
      { name: "Closing panel", role: "The next five years" },
    ],
  },
  {
    id: "clay-after-hours",
    title: "Clay After Hours",
    category: "Workshops",
    date: "Saturday, September 12, 2026",
    dateValue: "2026-09-12",
    time: "Workshop begins at 6:00 PM",
    venue: "Manikganj Art Studio",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 900,
    status: "A few places left",
    image:
      "https://images.pexels.com/photos/6023597/pexels-photo-6023597.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "People shaping pottery together in a hands-on workshop",
    about:
      "A hands-on evening of wheel throwing and hand-building. Clay, tools and firing are all included in the ticket.",
    lineup: [
      { name: "Priya Sen", role: "Studio lead" },
      { name: "Imran Chowdhury", role: "Hand-building table" },
    ],
  },
  {
    id: "good-city-summit",
    title: "Good City Summit",
    category: "Business Events",
    date: "Thursday, September 17, 2026",
    dateValue: "2026-09-17",
    time: "Doors at 9:00 AM",
    venue: "Manikganj Convention Center",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 2000,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/15448073/pexels-photo-15448073.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "A packed conference hall listening to a live presentation",
    about:
      "Founders, planners and civic teams on what makes a city work, from transport to public space.",
    lineup: [
      { name: "Farah Nower", role: "Keynote" },
      { name: "Sadia Karim", role: "Panel: transport" },
      { name: "Rakib Hasan", role: "Workshop: civic data" },
    ],
  },
  {
    id: "sunday-plates",
    title: "Sunday Plates: Night Market",
    category: "Other Experiences",
    date: "Sunday, October 4, 2026",
    dateValue: "2026-10-04",
    time: "Market opens at 2:00 PM",
    venue: "Manikganj Night Market",
    location: "Manikganj, Dhaka",
    city: "Manikganj",
    price: 300,
    status: "On sale now",
    image:
      "https://images.pexels.com/photos/41156914/pexels-photo-41156914.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    imageAlt: "An overhead view of a lively market with food stalls and visitors",
    about:
      "An evening market of home cooks, grill stalls and sweet shops, spread through the lanes of Manikganj Night Market.",
    lineup: [
      { name: "Home Cooks Row", role: "Stalls" },
      { name: "Charcoal & Co.", role: "Grill" },
      { name: "Mishti Corner", role: "Sweets" },
    ],
  },
];
