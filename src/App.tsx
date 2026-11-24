import { useEffect, useMemo, useRef, useState } from "react";
import { TICKSHOW_EVENTS } from "./data/events";
import type { EventCategory, TickShowEvent } from "./data/events";
import CoverflowCarousel from "./components/CoverflowCarousel";
import { Icon } from "./components/Icon";
import type { IconName } from "./components/Icon";
import FooterPage from "./components/FooterPages";
import type { FooterPageKey } from "./components/FooterPages";
import FooterReveal from "./components/FooterReveal";

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="TickShow home">
      <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
        <path
          d="M3 4h28v7c-4 0-4 10 0 10v9H3v-9c4 0 4-10 0-10Z"
          fill="currentColor"
        />
        <path d="M17 10v14M12 12h10" stroke="var(--ink)" strokeWidth="3" />
        <path d="M8 13v9" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="1.5 2" />
      </svg>
      <span className="brand-word">
        <span>Tick</span>
        <span>Show</span>
      </span>
    </a>
  );
}

const NAV_ITEMS = [
  { label: "Home", id: "home" },
  { label: "Explore events", id: "events" },
  { label: "Categories", id: "categories" },
  { label: "About us", id: "about" },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("home");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const sectionIds = NAV_ITEMS.map((item) => item.id);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (active) setActiveLink(active.target.id);
      },
      { rootMargin: "-30% 0px -58% 0px", threshold: [0, 0.15, 0.35] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavClick = (id: string) => {
    setActiveLink(id);
    setMenuOpen(false);
  };

  const navLinks = (mobile = false) =>
    NAV_ITEMS.map((item) => (
      <a
        key={item.id}
        href={`#${item.id}`}
        className={activeLink === item.id ? "nav-link is-active" : "nav-link"}
        aria-current={activeLink === item.id ? "location" : undefined}
        onClick={() => handleNavClick(item.id)}
        tabIndex={mobile && !menuOpen ? -1 : undefined}
      >
        {item.label}
      </a>
    ));

  return (
    <header className={scrolled ? "site-header is-scrolled" : "site-header"}>
      <div className="header-bar">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {navLinks()}
        </nav>
        <div className="desktop-actions">
          <a className="header-login" href="#/login">
            Log in
          </a>
          <a className="header-signup" href="#/signup">
            Sign up
          </a>
        </div>
        <div className="mobile-controls">
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={20} />
          </button>
        </div>
      </div>
      <div
        className={menuOpen ? "mobile-menu is-open" : "mobile-menu"}
        id="mobile-navigation"
        aria-hidden={!menuOpen}
      >
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navLinks(true)}
        </nav>
        <div className="mobile-menu-actions">
          <a
            className="mobile-menu-link"
            href="#/login"
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? 0 : -1}
          >
            Log in
          </a>
          <a
            className="mobile-menu-signup"
            href="#/signup"
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? 0 : -1}
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  );
}

const HERO_IMAGE =
  "https://images.pexels.com/videos/7722221/adult-aquarium-audience-band-7722221.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1080&w=1920";

function Hero({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero-media" aria-hidden="true">
        <img className="hero-poster" src={HERO_IMAGE} alt="" fetchPriority="high" />
        {!reducedMotion && (
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_IMAGE}
            onError={(event) => event.currentTarget.classList.add("video-unavailable")}
          >
            <source
              src="https://videos.pexels.com/video-files/7722221/7722221-hd_1920_1080_25fps.mp4"
              type="video/mp4"
            />
          </video>
        )}
      </div>
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-inner page-wrap">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <span className="eyebrow-mark" aria-hidden="true" />
            New York City · Live events
          </p>
          <h1 id="hero-title">
            <span>Don't just watch</span>
            <span className="hero-accent">Be there</span>
          </h1>
          <p className="hero-description">
            Concerts, games, festivals and theatre across New York, in one place.
          </p>
          <div className="hero-actions">
            <a className="button button-primary hero-primary" href="#events">
              Explore events <Icon name="arrowRight" />
            </a>
            <a className="button button-ghost" href="#about">
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsSection({
  events,
  activeCategory,
  onClear,
  onOpenEvent,
  reducedMotion,
}: {
  events: TickShowEvent[];
  activeCategory: EventCategory | "All";
  onClear: () => void;
  onOpenEvent: (event: TickShowEvent) => void;
  reducedMotion: boolean;
}) {
  const hasFilter = activeCategory !== "All";
  const supportingText = hasFilter
    ? `${events.length} ${events.length === 1 ? "event" : "events"} in ${activeCategory}.`
    : "Find your next night out.";

  return (
    <section className="events-section section-anchor" id="events" aria-labelledby="events-title">
      <div className="page-wrap">
        <div className="events-heading">
          <div className="events-title-block">
            <p className="section-kicker">Upcoming</p>
            <h2 id="events-title">What's <span>happening?</span></h2>
          </div>
          <div className="events-heading-side">
            <p>{supportingText}</p>
            {hasFilter && (
              <button className="text-action" type="button" onClick={onClear}>
                Clear filters <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </div>
        {events.length > 0 ? (
          <CoverflowCarousel
            events={events}
            onOpenEvent={onOpenEvent}
            reducedMotion={reducedMotion}
          />
        ) : (
          <div className="empty-results" role="status">
            <span className="empty-kicker">No matches</span>
            <p>Try a different category.</p>
            <button className="button button-dark" type="button" onClick={onClear}>
              Show all events <Icon name="arrowRight" size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const CATEGORY_MARKS: { name: EventCategory; icon: IconName }[] = [
  { name: "Concerts & Music", icon: "music" },
  { name: "Sports", icon: "sports" },
  { name: "Festivals", icon: "festival" },
  { name: "Theatre", icon: "theatre" },
  { name: "Technology", icon: "technology" },
  { name: "Workshops", icon: "workshop" },
  { name: "Business Events", icon: "business" },
  { name: "Other Experiences", icon: "experience" },
];

function CategoriesSection({
  activeCategory,
  onSelect,
}: {
  activeCategory: EventCategory | "All";
  onSelect: (category: EventCategory | "All") => void;
}) {
  return (
    <section className="categories-section section-anchor" id="categories" aria-labelledby="categories-title">
      <div className="page-wrap">
        <div className="categories-heading">
          <div>
            <p className="section-kicker section-kicker-light">Browse</p>
            <h2 id="categories-title">Good plans<br /><span>have a type</span></h2>
          </div>
          <button className="categories-all" type="button" onClick={() => onSelect("All")}>
            See everything <Icon name="arrowRight" size={18} />
          </button>
        </div>
        <div className="category-grid" aria-label="Choose an event category">
          {CATEGORY_MARKS.map((category) => (
            <button
              className={`category-link${activeCategory === category.name ? " is-selected" : ""}`}
              type="button"
              key={category.name}
              aria-pressed={activeCategory === category.name}
              onClick={() => onSelect(category.name)}
            >
              <Icon name={category.icon} size={20} />
              <span className="category-label">{category.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { number: "01", title: "Discover", text: "Find the events, people and places that pull you in." },
    { number: "02", title: "Book", text: "Choose your tickets and get the details sorted." },
    { number: "03", title: "Experience", text: "Show up and make a night of it." },
  ];

  return (
    <section className="how-section section-anchor" id="about" aria-labelledby="how-title">
      <div className="page-wrap">
        <div className="how-heading">
          <p className="section-kicker">How it works</p>
          <h2 id="how-title">How TickShow<br /><span>works</span></h2>
        </div>
        <div className="steps-grid">
          {steps.map((step) => (
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
    </section>
  );
}

function PromoSection() {
  return (
    <section className="promo-section" aria-labelledby="promo-title">
      <div className="page-wrap promo-inner">
        <div>
          <p className="section-kicker section-kicker-light">Make it a night</p>
          <h2 id="promo-title">There's always<br /><span>something on</span></h2>
        </div>
        <div className="promo-action">
          <p>Concerts, games, festivals and shows across New York.</p>
          <a className="button button-primary" href="#events">
            Find your next event <Icon name="arrowRight" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();

  return (
    <div className="site-footer">
      <div className="page-wrap">
        <div className="footer-main">
          <div className="footer-brand-block">
            <Brand />
            <p>Live events across New York, all in one place.</p>
            <div className="social-links" aria-label="Social media">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a>
              <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">YouTube</a>
            </div>
          </div>
          <div className="footer-link-column">
            <h2>Explore</h2>
            <a href="#/events">All events</a>
            <a href="#/categories">Categories</a>
            <a href="#/upcoming">Upcoming events</a>
          </div>
          <div className="footer-link-column">
            <h2>Company</h2>
            <a href="#/about">About us</a>
            <a href="#/contact">Contact</a>
            <a href="#/terms">Terms &amp; conditions</a>
            <a href="#/privacy">Privacy policy</a>
          </div>
          <div className="footer-link-column">
            <h2>Support</h2>
            <a href="#/help">Help center</a>
            <a href="#/faqs">FAQs</a>
            <a href="#/support">Booking support</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>Copyright {year} TickShow. All rights reserved.</span>
          <span className="footer-motto">The show is better in person.</span>
          <a href="#home">Back to top</a>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const [notice, setNotice] = useState("");

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#home">
          <Icon name="arrowLeft" size={16} /> Back to home
        </a>
      </div>
      <main className="auth-main">
        <div className="auth-showcase" aria-hidden="true">
          <img className="auth-photo" src={HERO_IMAGE} alt="" />
          <div className="auth-showcase-copy">
            <p className="auth-brandline">Don't just watch. Be there</p>
            <p className="auth-brandnote">Live events across New York, all in one place.</p>
          </div>
        </div>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Account</p>
            <h1 id="auth-title">{isLogin ? "Log in" : "Create an account"}</h1>
            <p className="auth-card-intro">
              {isLogin
                ? "Use the email and password on your TickShow account."
                : "One account for every plan you make."}
            </p>
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("This is a frontend preview. No account information was sent.");
              }}
            >
              {!isLogin && (
                <>
                  <label htmlFor="auth-name">Full name</label>
                  <input id="auth-name" name="name" type="text" autoComplete="name" required />
                </>
              )}
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" name="email" type="email" autoComplete="email" required />
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={8}
                required
              />
              <button className="button button-primary auth-submit" type="submit">
                {isLogin ? "Log in" : "Create account"} <Icon name="arrowRight" size={18} />
              </button>
            </form>
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <p className="auth-switch">
              {isLogin ? "New to TickShow?" : "Already have an account?"}{" "}
              <a href={isLogin ? "#/signup" : "#/login"}>
                {isLogin ? "Create an account" : "Log in"}
              </a>
            </p>
            <p className="auth-card-note">This preview doesn't send any account data.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

type Route = "home" | "login" | "signup" | FooterPageKey;

const FOOTER_ROUTES: FooterPageKey[] = [
  "events",
  "upcoming",
  "categories",
  "about",
  "contact",
  "terms",
  "privacy",
  "faqs",
  "help",
  "support",
];

function getRoute(): Route {
  const hash = window.location.hash;
  if (!hash.startsWith("#/")) return "home";
  const value = hash.slice(2).toLowerCase();
  if (value === "login" || value === "signup") return value;
  if (FOOTER_ROUTES.includes(value as FooterPageKey)) return value as FooterPageKey;
  return "home";
}

type ModalState =
  | { kind: "event"; event: TickShowEvent }
  | { kind: "info"; title: string; body: string }
  | null;

function App() {
  const [activeCategory, setActiveCategory] = useState<EventCategory | "All">("All");
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [route, setRoute] = useState<Route>(getRoute);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (route !== "home") {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const targetId = window.location.hash.replace(/^#\/?/, "");
    const target = targetId ? document.getElementById(targetId) : null;
    if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
  }, [route]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  const matchingEvents = useMemo(
    () =>
      activeCategory === "All"
        ? TICKSHOW_EVENTS
        : TICKSHOW_EVENTS.filter((event) => event.category === activeCategory),
    [activeCategory],
  );

  const displayedEvents = matchingEvents;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const clearFilters = () => setActiveCategory("All");

  const selectCategory = (category: EventCategory | "All") => {
    setActiveCategory(category);
    window.setTimeout(() => scrollTo("events"), 20);
  };

  const closeModal = () => setModal(null);

  if (route === "login" || route === "signup") {
    return <AuthPage key={route} mode={route} />;
  }

  const openEvent = (event: TickShowEvent) => setModal({ kind: "event", event });

  const pageContent =
    route === "home" ? (
      <>
        <Header />
        <main>
          <Hero reducedMotion={reducedMotion} />
          <EventsSection
            events={displayedEvents}
            activeCategory={activeCategory}
            onClear={clearFilters}
            onOpenEvent={openEvent}
            reducedMotion={reducedMotion}
          />
          <CategoriesSection activeCategory={activeCategory} onSelect={selectCategory} />
          <HowItWorks />
          <PromoSection />
        </main>
      </>
    ) : (
      <FooterPage
        key={route}
        page={route}
        events={TICKSHOW_EVENTS}
        onOpenEvent={openEvent}
      />
    );

  return (
    <>
      <FooterReveal content={pageContent} footer={<Footer />} />
      <dialog
        ref={dialogRef}
        className="tick-dialog"
        aria-labelledby={modal ? "dialog-title" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClose={closeModal}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
      >
        {modal && (
          <div className="dialog-content">
            <div className="dialog-topline">
              <span>TickShow / {modal.kind === "event" ? "Event details" : "The fine print"}</span>
              <button className="dialog-close" type="button" onClick={closeModal} aria-label="Close dialog">
                <Icon name="close" size={18} />
              </button>
            </div>
            {modal.kind === "event" && (
              <div className="event-dialog-body">
                <p className="dialog-kicker">{modal.event.category}</p>
                <h2 id="dialog-title">{modal.event.title}</h2>
                <div className="dialog-event-details">
                  <div><span>Date &amp; time</span><strong>{modal.event.date}</strong><small>{modal.event.time}</small></div>
                  <div><span>Venue</span><strong>{modal.event.venue}</strong><small>{modal.event.location}</small></div>
                  <div><span>Tickets from</span><strong>${modal.event.price}</strong><small>{modal.event.status}</small></div>
                </div>
                <p className="dialog-disclaimer">This is sample event information. Ticket checkout and booking are not connected in this preview.</p>
                <button className="button button-dark dialog-primary" type="button" onClick={closeModal}>
                  Back to events <Icon name="arrowRight" size={18} />
                </button>
              </div>
            )}
            {modal.kind === "info" && (
              <div className="info-dialog-body">
                <p className="dialog-kicker">TickShow / Information</p>
                <h2 id="dialog-title">{modal.title}</h2>
                <p className="info-copy">{modal.body}</p>
                <button className="button button-dark dialog-primary" type="button" onClick={closeModal}>
                  Got it <Icon name="arrowRight" size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

export default App;