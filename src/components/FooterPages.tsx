import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { EVENT_CATEGORIES } from "../data/events";
import type { TickShowEvent } from "../data/events";
import Brand from "./Brand";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { submitSupportMessage } from "../lib/support";

export type FooterPageKey =
  | "events"
  | "upcoming"
  | "categories"
  | "about"
  | "how-it-works"
  | "contact"
  | "terms"
  | "privacy"
  | "faqs"
  | "help"
  | "support";

type InfoSection = {
  heading: string;
  paragraphs?: string[];
  items?: { term: string; detail: string }[];
};

type PageData = {
  kicker: string;
  title: string;
  accent: string;
  intro: string;
  sections: InfoSection[];
};

const INFO_PAGES: Record<
  Exclude<FooterPageKey, "events" | "upcoming" | "categories" | "how-it-works">,
  PageData
> = {
  about: {
    kicker: "Our story",
    title: "Live music,",
    accent: "real moments",
    intro:
      "TickShow is a home for the nights you'll talk about later. We bring Manikganj's concerts, games, festivals and shows into one simple place.",
    sections: [
      {
        heading: "What we do",
        paragraphs: [
          "We collect events from across Manikganj, Dhaka and put them in one clear, browsable feed. See the important details up front, and get straight to the organizer's official ticketing link.",
          "No clutter, no endless tabs. Just the plans worth making.",
        ],
      },
      {
        heading: "Why in person",
        paragraphs: [
          "A crowd singing along, the energy of a live game, the hush before a curtain rises. These are the things a screen can't reproduce. We built TickShow to make it easier to be there.",
        ],
      },
      {
        heading: "The team",
        paragraphs: [
          "TickShow is a small group of Manikganj locals who go to too many shows and never stop talking about the next one.",
        ],
      },
    ],
  },
  contact: {
    kicker: "Say hello",
    title: "Get in",
    accent: "touch",
    intro:
      "Questions, ideas, or a venue we should know about? Send us a note and we'll get back to you.",
    sections: [
      {
        heading: "Direct lines",
        items: [
          { term: "General enquiries", detail: "hello@tickshow.com" },
          { term: "Partnerships", detail: "partners@tickshow.com" },
          { term: "Press", detail: "press@tickshow.com" },
        ],
      },
      {
        heading: "Office",
        paragraphs: [
          "TickShow, Manikganj, Dhaka, Bangladesh. We're usually around on weekdays, 10am–6pm BST.",
        ],
      },
    ],
  },
  terms: {
    kicker: "The fine print",
    title: "Terms &",
    accent: "conditions",
    intro:
      "A short summary of how this TickShow preview works. Please read it before using the site.",
    sections: [
      {
        heading: "Preview only",
        paragraphs: [
          "Checkout currently uses a no-charge demo payment. Demo bookings are saved to your account, but no real payment is taken and no valid entry ticket is issued.",
        ],
      },
      {
        heading: "Event information",
        paragraphs: [
          "Dates, venues, prices and availability are provided by event organizers. Confirm details with the organizer before making plans.",
        ],
      },
      {
        heading: "Accounts",
        paragraphs: [
          "Accounts are managed through TickShow authentication. You can update your account name, view demo bookings, and permanently delete your account from your dashboard after confirming your password.",
        ],
      },
      {
        heading: "External links",
        paragraphs: [
          "Links to social platforms or organizers lead to third-party websites with their own terms and privacy practices.",
        ],
      },
    ],
  },
  privacy: {
    kicker: "Your data",
    title: "Privacy",
    accent: "policy",
    intro:
      "TickShow stores the account and booking information needed to manage your demo bookings.",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your account email and name, plus the name, email and phone number attached to a booking. This information is stored in the TickShow Supabase database and is available to authorized administrators.",
        ],
      },
      {
        heading: "Cookies and storage",
        paragraphs: [
          "Supabase authentication stores the session needed to keep you signed in. Booking confirmations may also be cached in your browser.",
        ],
      },
      {
        heading: "Account deletion",
        paragraphs: [
          "Deleting your account removes your profile and demo bookings. Financial order records are retained with customer contact details anonymized. Account deletion is confirmed with your password; we do not send a separate deletion email.",
        ],
      },
      {
        heading: "Third parties",
        paragraphs: [
          "Event images are served from a public image provider, and external links may have their own policies. We are not responsible for content on third-party sites.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          "If you have questions about privacy, write to privacy@tickshow.com.",
        ],
      },
    ],
  },
  faqs: {
    kicker: "Good to know",
    title: "Frequently asked",
    accent: "questions",
    intro:
      "A few quick answers about what TickShow is and what you can do here.",
    sections: [
      {
        heading: "The basics",
        items: [
          {
            term: "Is TickShow a ticketing site?",
            detail:
              "Checkout is currently a no-charge demo. It records bookings but does not take real payment or issue valid entry tickets.",
          },
          {
            term: "Are the events real?",
            detail:
              "Events are managed through TickShow. Confirm details with the event organizer before making plans.",
          },
          {
            term: "Do I need an account?",
            detail:
              "You can browse without an account, but you must sign in or create an account to book.",
          },
          {
            term: "Can I filter by category?",
            detail:
              "Yes. Use the Categories section on the home page to narrow the lineup.",
          },
        ],
      },
      {
        heading: "Still stuck?",
        paragraphs: [
          "Reach the team at help@tickshow.com and we'll point you in the right direction.",
        ],
      },
    ],
  },
  help: {
    kicker: "We're here",
    title: "Help",
    accent: "center",
    intro:
      "Find your way around TickShow and get answers to the most common questions.",
    sections: [
      {
        heading: "Browsing events",
        paragraphs: [
          "Open the Events section on the home page. Drag the carousel, use the arrow buttons, pick a dot, or press the left and right arrow keys to move through the lineup. Click the active card to see its details.",
        ],
      },
      {
        heading: "Finding a category",
        paragraphs: [
          "Scroll to Categories and choose a type. The event lineup will update to match. Use 'Clear filters' to see everything again.",
        ],
      },
      {
        heading: "Event details",
        paragraphs: [
          "Select any event card to open its own page with the lineup, date, venue, price and status. Sign in or create an account to continue to the demo checkout.",
        ],
      },
      {
        heading: "More help",
        items: [
          { term: "FAQs", detail: "Quick answers to common questions." },
          { term: "Booking support", detail: "Questions about a specific booking." },
          { term: "Contact", detail: "Talk to the TickShow team." },
        ],
      },
    ],
  },
  support: {
    kicker: "Booking help",
    title: "Booking",
    accent: "support",
    intro:
      "Need a hand with an order or a question about an event? Tell us what's going on below.",
    sections: [
      {
        heading: "Before you write",
        paragraphs: [
          "TickShow demo bookings are not paid orders or valid tickets. If you already have tickets, contact the organizer or the official ticketing provider listed on your confirmation.",
        ],
      },
      {
        heading: "Other ways to reach us",
        items: [
          { term: "Email", detail: "support@tickshow.com" },
          { term: "Booking enquiries", detail: "help@tickshow.com" },
          { term: "Response time", detail: "Usually within two business days" },
        ],
      },
    ],
  },
};

const PAGE_TITLES: Record<FooterPageKey, string> = {
  events: "Explore events",
  upcoming: "Upcoming events",
  categories: "Categories",
  about: "About us",
  "how-it-works": "How it works",
  contact: "Contact",
  terms: "Terms & conditions",
  privacy: "Privacy policy",
  faqs: "FAQs",
  help: "Help center",
  support: "Booking support",
};

const CATEGORY_ICONS: IconName[] = [
  "music",
  "sports",
  "festival",
  "theatre",
  "technology",
  "workshop",
  "business",
  "experience",
];

const HOW_IT_WORKS_STEPS = [
  { number: "01", title: "Discover", text: "Find the events, people and places that pull you in." },
  { number: "02", title: "Book", text: "Choose your tickets and get the details sorted." },
  { number: "03", title: "Experience", text: "Show up and make a night of it." },
];

function PageShell({
  kicker,
  title,
  accent,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  accent: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="footer-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#home">
          <Icon name="arrowLeft" size={16} /> Back to home
        </a>
      </div>
      <main className="footer-page-main">
        <div className="page-wrap">
          <header className="footer-page-header">
            <p className="section-kicker">{kicker}</p>
            <h1>
              {title} <span>{accent}</span>
            </h1>
            <p className="footer-page-intro">{intro}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

function EventGrid({
  events,
  onOpenEvent,
}: {
  events: TickShowEvent[];
  onOpenEvent: (event: TickShowEvent) => void;
}) {
  return (
    <div className="page-event-grid">
      {events.map((event) => (
        <article className="page-event-card" key={event.id}>
          <img src={event.image} alt={event.imageAlt} loading="lazy" />
          <div className="page-event-body">
            <span className="page-event-tag">{event.category}</span>
            <h2>{event.title}</h2>
            <p className="page-event-meta">
              {event.date} · {event.venue}
            </p>
            <div className="page-event-foot">
              <strong>৳{event.price}</strong>
              <button type="button" onClick={() => onOpenEvent(event)}>
                Details <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function InfoContent({ sections }: { sections: InfoSection[] }) {
  return (
    <div className="footer-page-content">
      {sections.map((section) => (
        <section className="footer-page-section" key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.items && (
            <dl className="footer-page-list">
              {section.items.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.detail}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}

function MessageForm({
  label,
  formType,
}: {
  label: string;
  formType: "contact" | "support";
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setSent(false);
    setError("");
    try {
      await submitSupportMessage({ email, message, formType });
      setEmail("");
      setMessage("");
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your message could not be submitted.");
    } finally {
      setSending(false);
    }
  };
  return (
    <form className="footer-page-form" onSubmit={handleSubmit}>
      <label htmlFor="page-email">Your email</label>
      <input
        id="page-email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        placeholder="you@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setSent(false);
        }}
      />
      <label htmlFor="page-message">Message</label>
      <textarea
        id="page-message"
        rows={5}
        required
        maxLength={5000}
        placeholder={label}
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setSent(false);
        }}
      />
      <button className="button button-primary" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send message"} {!sending && <Icon name="arrowRight" size={18} />}
      </button>
      {error && <p className="footer-page-notice" role="alert">{error}</p>}
      {sent && (
        <p className="footer-page-notice" role="status">
          Your message was received and saved in the TickShow support inbox.
        </p>
      )}
    </form>
  );
}

export default function FooterPage({
  page,
  events,
  onOpenEvent,
}: {
  page: FooterPageKey;
  events: TickShowEvent[];
  onOpenEvent: (event: TickShowEvent) => void;
}) {
  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [page]);

  if (page === "events" || page === "upcoming") {
    return (
      <PageShell
        kicker="The lineup"
        title={page === "events" ? "Explore" : "Upcoming"}
        accent="events"
        intro="Every show, game and gathering across Manikganj, Dhaka. Pick a card for the full details."
      >
        {events.length ? (
          <EventGrid events={events} onOpenEvent={onOpenEvent} />
        ) : (
          <p className="footer-page-intro">No events are listed right now. Please check back soon.</p>
        )}
      </PageShell>
    );
  }

  if (page === "categories") {
    return (
      <PageShell
        kicker="Browse"
        title="Find your"
        accent="type"
        intro="From stadium nights to small workshops, there's a category for every kind of plan."
      >
        <div className="page-category-grid">
          {EVENT_CATEGORIES.map((category, index) => (
            <a className="page-category-link" href="#/events" key={category}>
              <Icon name={CATEGORY_ICONS[index] ?? "experience"} size={22} />
              <span>{category}</span>
              <Icon name="arrowRight" size={16} />
            </a>
          ))}
        </div>
      </PageShell>
    );
  }

  if (page === "how-it-works") {
    return (
      <PageShell
        kicker="How it works"
        title="How TickShow"
        accent="works"
        intro="Three simple steps from finding a night out to being in the middle of it."
      >
        <div className="footer-page-content">
          <div className="steps-grid">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <article className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <div className="step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  const data = INFO_PAGES[page];
  const showForm = page === "contact" || page === "support";

  return (
    <PageShell
      kicker={data.kicker}
      title={data.title}
      accent={data.accent}
      intro={data.intro}
    >
      <InfoContent sections={data.sections} />
      {showForm && (
        <MessageForm
          formType={page === "contact" ? "contact" : "support"}
          label={
            page === "contact"
              ? "Tell us what's on your mind..."
              : "Describe the booking you need help with..."
          }
        />
      )}
    </PageShell>
  );
}
