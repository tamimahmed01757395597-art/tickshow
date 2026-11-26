import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EventCategory, TickShowEvent } from "./data/events";
import { useStorefrontEvents } from "./lib/storefront";
import type { StorefrontEvent } from "./lib/storefront";
import Brand from "./components/Brand";
import CheckoutPage from "./components/CheckoutPage";
import CoverflowCarousel from "./components/CoverflowCarousel";
import EventPage from "./components/EventPage";
import OrderPage from "./components/OrderPage";
import { findBooking } from "./data/bookings";
import { Icon } from "./components/Icon";
import type { IconName } from "./components/Icon";
import FooterPage from "./components/FooterPages";
import type { FooterPageKey } from "./components/FooterPages";
import FooterReveal from "./components/FooterReveal";
import AdminPanel from "./components/AdminPanel";
import { useAuth } from "./lib/auth";

const NAV_ITEMS = [
  { label: "Home", href: "#home", id: "home" },
  { label: "Explore events", href: "#/events" },
  { label: "About us", href: "#/about" },
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavClick = (id?: string) => {
    if (id) setActiveLink(id);
    setMenuOpen(false);
  };

  const navLinks = (mobile = false) =>
    NAV_ITEMS.map((item) => (
      <a
        key={item.label}
        href={item.href}
        className={item.id && activeLink === item.id ? "nav-link is-active" : "nav-link"}
        aria-current={item.id && activeLink === item.id ? "location" : undefined}
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
            Manikganj, Dhaka · Live events
          </p>
          <h1 id="hero-title">
            <span>Don't just watch</span>
            <span className="hero-accent">Be there</span>
          </h1>
          <p className="hero-description">
            Concerts, games, festivals and theatre across Manikganj, Dhaka, in one place.
          </p>
          <div className="hero-actions">
            <a className="button button-primary hero-primary" href="#/events">
              Explore events <Icon name="arrowRight" />
            </a>
            <a className="button button-ghost" href="#/how-it-works">
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
  pastEvents,
  carouselEvents,
  activeCategory,
  onClear,
  onOpenEvent,
  reducedMotion,
}: {
  events: StorefrontEvent[];
  pastEvents: StorefrontEvent[];
  carouselEvents: StorefrontEvent[];
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
            <p className="section-kicker">Upcoming &amp; ongoing</p>
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
          <div className="page-event-grid upcoming-event-grid">
            {events.map((event) => (
              <article className="page-event-card" key={event.id}>
                <img src={event.image} alt={event.imageAlt} loading="lazy" decoding="async" />
                <div className="page-event-body">
                  <span className="page-event-tag">{event.category}</span>
                  <h3>{event.title}</h3>
                  <p className="page-event-meta">
                    {event.date} <span aria-hidden="true">·</span> {event.venue}
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
        ) : (
          <div className="empty-results" role="status">
            <span className="empty-kicker">No matches</span>
            <p>Try a different category.</p>
            <button className="button button-dark" type="button" onClick={onClear}>
              Show all events <Icon name="arrowRight" size={18} />
            </button>
          </div>
        )}

        <div className="events-past">
          <div className="events-heading">
            <div className="events-title-block">
              <p className="section-kicker">The lineup</p>
              <h2>Featured <span>events</span></h2>
            </div>
            <div className="events-heading-side">
              <p>Highlights picked for the coverflow carousel.</p>
            </div>
          </div>
          <CoverflowCarousel
            events={carouselEvents.length ? carouselEvents : pastEvents}
            onOpenEvent={onOpenEvent}
            reducedMotion={reducedMotion}
          />
        </div>
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

function PromoSection() {
  return (
    <section className="promo-section" aria-labelledby="promo-title">
      <div className="page-wrap promo-inner">
        <div>
          <p className="section-kicker section-kicker-light">Make it a night</p>
          <h2 id="promo-title">There's always<br /><span>something on</span></h2>
        </div>
        <div className="promo-action">
          <p>Concerts, games, festivals and shows across Manikganj, Dhaka.</p>
          <a className="button button-primary" href="#/events">
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
        <div className="footer-ticket">
          <div className="ticket-header" aria-hidden="true">
            <span className="ticket-admit">Admit one</span>
            <span className="ticket-series">TickShow / Manikganj</span>
            <span className="ticket-serial">No. TS-{year}-001</span>
          </div>
          <div className="ticket-body">
            <div className="footer-main">
              <div className="footer-brand-block">
                <Brand />
                <a className="footer-mobile-help" href="#/help">
                  <span>Help center</span>
                  <Icon name="arrowRight" size={18} />
                </a>
                <div className="social-links" aria-label="Social media">
                  <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                    <span className="social-link-label">Instagram</span>
                    <span className="social-link-mark" aria-hidden="true">IG</span>
                  </a>
                  <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">
                    <span className="social-link-label">TikTok</span>
                    <span className="social-link-mark" aria-hidden="true">TT</span>
                  </a>
                  <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube">
                    <span className="social-link-label">YouTube</span>
                    <span className="social-link-mark" aria-hidden="true">YT</span>
                  </a>
                </div>
              </div>
              <div className="footer-link-column">
                <h2>Explore</h2>
                <a href="#/events"><span>Explore events</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/categories"><span>Categories</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/upcoming"><span>Upcoming events</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
              </div>
              <div className="footer-link-column">
                <h2>Company</h2>
                <a href="#/about"><span>About us</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/how-it-works"><span>How it works</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/contact"><span>Contact</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/terms"><span>Terms &amp; conditions</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/privacy"><span>Privacy policy</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
              </div>
              <div className="footer-link-column">
                <h2>Support</h2>
                <a href="#/help"><span>Help center</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/faqs"><span>FAQs</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
                <a href="#/support"><span>Booking support</span><Icon className="footer-link-arrow" name="arrowRight" size={16} /></a>
              </div>
            </div>
            <div className="footer-bottom">
              <div className="footer-bottom-copy">
                <span>Copyright {year} TickShow. All rights reserved.</span>
                <span className="footer-motto">The show is better in person.</span>
              </div>
              <div className="ticket-barcode" aria-hidden="true" />
              <div className="social-links footer-social-compact" aria-label="Social media">
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <span className="social-link-label">Instagram</span>
                  <span className="social-link-mark" aria-hidden="true">IG</span>
                </a>
                <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">
                  <span className="social-link-label">TikTok</span>
                  <span className="social-link-mark" aria-hidden="true">TT</span>
                </a>
                <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube">
                  <span className="social-link-label">YouTube</span>
                  <span className="social-link-mark" aria-hidden="true">YT</span>
                </a>
              </div>
              <a href="#home">Back to top</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const { configured, signIn, signUp, refresh } = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!configured) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a local .env file.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("name") ?? "");
    const inviteToken = String(form.get("inviteToken") ?? "");

    setBusy(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        // Let the admin panel perform the authoritative role check. The login
        // page can otherwise show a false negative if role state is still being
        // refreshed after the session change.
        await refresh();
        window.location.hash = "#/admin";
        return;
      }

      const result = await signUp({ email, password, fullName, inviteToken });
      const roles = await refresh();
      if (result.needsConfirmation) {
        setNotice("Account created. Confirm your email address, then log in to open the admin panel.");
      } else if (roles.includes("admin")) {
        window.location.hash = "#/admin";
      } else {
        setNotice("Account created as a customer. An administrator can assign additional roles.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
            <p className="auth-brandnote">Live events across Manikganj, Dhaka, all in one place.</p>
          </div>
        </div>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Administrator access</p>
            <h1 id="auth-title">{isLogin ? "Log in" : "Create an account"}</h1>
            <p className="auth-card-intro">
              {isLogin
                ? "Use the email and password of an authorized TickShow administrator."
                : "One account for every plan you make. Add an admin invite token to create an administrator account."}
            </p>
            <form className="auth-form" onSubmit={handleSubmit}>
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
              {!isLogin && (
                <>
                  <label htmlFor="auth-invite">Admin invitation token (optional)</label>
                  <input
                    id="auth-invite"
                    name="inviteToken"
                    type="text"
                    autoComplete="off"
                    placeholder="Leave blank for a customer account"
                  />
                  <p className="auth-field-hint">
                    Only the token hash is stored. A token works once and must match this email.
                  </p>
                </>
              )}
              <button className="button button-primary auth-submit" type="submit" disabled={busy}>
                {busy ? "Please wait…" : isLogin ? "Log in to admin" : "Create account"}{" "}
                {!busy && <Icon name="arrowRight" size={18} />}
              </button>
            </form>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
            {!configured && (
              <p className="auth-error" role="alert">
                Backend setup: copy <code>.env.example</code> to <code>.env.local</code>, add your
                public Supabase URL and anon key, then restart the dev server.
              </p>
            )}
            <p className="auth-switch">
              {isLogin ? "Need an admin account?" : "Already have an admin account?"}{" "}
              <a href={isLogin ? "#/signup" : "#/login"}>
                {isLogin ? "Sign up with an invite" : "Log in"}
              </a>
            </p>
            <p className="auth-card-note">
              Administrator roles are assigned by the database, never by the browser.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

type Route =
  | { name: "home" }
  | { name: "admin" }
  | { name: "login" }
  | { name: "signup" }
  | { name: "event"; id: string }
  | { name: "checkout"; id: string }
  | { name: "order"; reference: string }
  | { name: "page"; page: FooterPageKey };

const FOOTER_ROUTES: FooterPageKey[] = [
  "events",
  "upcoming",
  "categories",
  "about",
  "how-it-works",
  "contact",
  "terms",
  "privacy",
  "faqs",
  "help",
  "support",
];

function getRoute(): Route {
  const hash = window.location.hash;
  if (!hash.startsWith("#/")) return { name: "home" };
  const value = hash.slice(2).toLowerCase();
  if (value === "admin") return { name: "admin" };
  if (value === "login" || value === "signup") return { name: value };
  if (value.startsWith("event/")) {
    return { name: "event", id: decodeURIComponent(value.slice("event/".length)) };
  }
  if (value.startsWith("checkout/")) {
    return { name: "checkout", id: decodeURIComponent(value.slice("checkout/".length)) };
  }
  if (value.startsWith("order/")) {
    return { name: "order", reference: decodeURIComponent(value.slice("order/".length)) };
  }
  if (FOOTER_ROUTES.includes(value as FooterPageKey)) {
    return { name: "page", page: value as FooterPageKey };
  }
  return { name: "home" };
}

function byDisplayOrder(a: StorefrontEvent, b: StorefrontEvent) {
  const groupRank = { ongoing: 0, upcoming: 1, past: 2 } as const;
  return (
    groupRank[a.showcaseGroup] - groupRank[b.showcaseGroup] ||
    a.displayOrder - b.displayOrder ||
    a.title.localeCompare(b.title)
  );
}

function App() {
  const [activeCategory, setActiveCategory] = useState<EventCategory | "All">("All");
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [route, setRoute] = useState<Route>(getRoute);
  const { events: showcaseEvents } = useStorefrontEvents();

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (route.name !== "home") {
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

  const liveEvents = useMemo(
    () => showcaseEvents.filter((event) => event.showcaseGroup !== "past").sort(byDisplayOrder),
    [showcaseEvents],
  );
  const pastEvents = useMemo(
    () => showcaseEvents.filter((event) => event.showcaseGroup === "past").sort(byDisplayOrder),
    [showcaseEvents],
  );
  const carouselEvents = useMemo(
    () =>
      showcaseEvents
        .filter((event) => event.isCarousel)
        .sort((a, b) => a.carouselOrder - b.carouselOrder || a.title.localeCompare(b.title)),
    [showcaseEvents],
  );

  const matchingEvents = useMemo(
    () =>
      activeCategory === "All"
        ? liveEvents
        : liveEvents.filter((event) => event.category === activeCategory),
    [activeCategory, liveEvents],
  );

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

  if (route.name === "login" || route.name === "signup") {
    return <AuthPage key={route.name} mode={route.name} />;
  }
  if (route.name === "admin") {
    return <AdminPanel />;
  }

  const openEvent = (event: TickShowEvent) => {
    window.location.hash = `#/event/${event.id}`;
  };

  const activeEvent =
    route.name === "event" ? showcaseEvents.find((event) => event.id === route.id) : undefined;
  const isPastEvent = activeEvent?.showcaseGroup === "past";
  const checkoutEvent =
    route.name === "checkout" ? showcaseEvents.find((event) => event.id === route.id) : undefined;
  const booking = route.name === "order" ? findBooking(route.reference) : undefined;
  const bookingEvent =
    booking !== undefined
      ? showcaseEvents.find((event) => event.id === booking.eventId)
      : undefined;

  let pageContent;
  if (route.name === "home") {
    pageContent = (
      <>
        <Header />
        <main>
          <Hero reducedMotion={reducedMotion} />
          <EventsSection
            events={matchingEvents}
            pastEvents={pastEvents}
            carouselEvents={carouselEvents}
            activeCategory={activeCategory}
            onClear={clearFilters}
            onOpenEvent={openEvent}
            reducedMotion={reducedMotion}
          />
          <CategoriesSection activeCategory={activeCategory} onSelect={selectCategory} />
          <PromoSection />
        </main>
      </>
    );
  } else if (route.name === "event") {
    pageContent = activeEvent ? (
      <EventPage event={activeEvent} isPast={isPastEvent} />
    ) : (
      <FooterPage page="events" events={liveEvents} onOpenEvent={openEvent} />
    );
  } else if (route.name === "checkout") {
    pageContent = checkoutEvent ? (
      <CheckoutPage event={checkoutEvent} isPast={checkoutEvent.showcaseGroup === "past"} />
    ) : (
      <FooterPage page="events" events={liveEvents} onOpenEvent={openEvent} />
    );
  } else if (route.name === "order") {
    pageContent =
      booking !== undefined && bookingEvent !== undefined ? (
        <OrderPage booking={booking} event={bookingEvent} />
      ) : (
        <FooterPage page="events" events={liveEvents} onOpenEvent={openEvent} />
      );
  } else {
    pageContent = (
      <FooterPage
        key={route.page}
        page={route.page}
        events={liveEvents}
        onOpenEvent={openEvent}
      />
    );
  }

  return <FooterReveal content={pageContent} footer={<Footer />} />;
}

export default App;