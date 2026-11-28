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
import AccountDashboard from "./components/AccountDashboard";
import { requireSupabase } from "./lib/supabase";

const NAV_ITEMS = [
  { label: "Home", href: "#home", id: "home" },
  { label: "Explore events", href: "#/events" },
  { label: "About us", href: "#/about" },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

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
          {user ? (
            <a className="header-signup" href="#/account">My account</a>
          ) : (
            <>
              <a className="header-login" href="#/login">Log in</a>
              <a className="header-signup" href="#/signup">Sign up</a>
            </>
          )}
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
          {user ? (
            <a
              className="mobile-menu-signup"
              href="#/account"
              onClick={() => setMenuOpen(false)}
              tabIndex={menuOpen ? 0 : -1}
            >
              My account
            </a>
          ) : (
            <>
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
            </>
          )}
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
            <p>{hasFilter ? "Try a different category." : "New events will appear here when available."}</p>
            <button className="button button-dark" type="button" onClick={onClear}>
              Show all events <Icon name="arrowRight" size={18} />
            </button>
          </div>
        )}

        {(carouselEvents.length > 0 || pastEvents.length > 0) && <div className="events-past">
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
        </div>}
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

type AuthMode = "login" | "signup" | "staff-login" | "staff-signup";

function requestedDestination() {
  const query = window.location.hash.split("?")[1] ?? "";
  const requested = new URLSearchParams(query).get("next") ?? "";
  if (requested === "admin") return "admin";
  if (/^checkout\/[a-z0-9-]+$/i.test(requested)) return requested;
  return "account";
}

function destinationHash(destination: string) {
  return destination === "admin" ? "#/admin" : `#/${destination}`;
}

function AuthPage({ mode }: { mode: AuthMode }) {
  const isStaff = mode.startsWith("staff-");
  const isLogin = mode.endsWith("login");
  const { configured, signIn, signUp, refresh } = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const destination = isStaff ? "admin" : requestedDestination();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!configured) {
      setError("Supabase is not configured. Add the public Supabase URL and anon key, then redeploy.");
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
        const roles = await refresh();
        if (isStaff && !roles.includes("admin")) {
          window.location.hash = "#/admin";
          return;
        }
        window.location.hash = destinationHash(destination);
        return;
      }

      const result = await signUp({
        email,
        password,
        fullName,
        inviteToken: isStaff ? inviteToken : undefined,
        returnTo: destination,
      });
      if (result.needsConfirmation) {
        setNotice("Account created. Check your email and follow the confirmation link to continue.");
        return;
      }
      const roles = await refresh();
      if (isStaff && !roles.includes("admin")) {
        throw new Error("The invitation did not grant administrator access.");
      }
      window.location.hash = destinationHash(destination);
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
            <p className="auth-card-kicker">{isStaff ? "Staff portal" : "Your TickShow account"}</p>
            <h1 id="auth-title">
              {isStaff ? "Administrator access" : isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="auth-card-intro">
              {isStaff
                ? isLogin
                  ? "Sign in with an administrator account."
                  : "Use the single-use invitation sent by an administrator."
                : isLogin
                  ? "Log in to manage your bookings and tickets."
                  : "Create an account to book tickets and manage your bookings."}
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
              <div className="auth-password-wrap">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {!isLogin && isStaff && (
                <>
                  <label htmlFor="auth-invite">Admin invitation token</label>
                  <input id="auth-invite" name="inviteToken" type="text" autoComplete="off" required />
                </>
              )}
              <button className="button button-primary auth-submit" type="submit" disabled={busy}>
                {busy ? "Please wait…" : isStaff ? "Continue to staff portal" : isLogin ? "Log in" : "Create account"}{" "}
                {!busy && <Icon name="arrowRight" size={18} />}
              </button>
            </form>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {!configured && (
              <p className="auth-error" role="alert">
                Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your deployment.
              </p>
            )}
            {isLogin && (
              <p className="auth-switch">
                <a href={`#/forgot-password?next=${encodeURIComponent(destination)}`}>Forgot your password?</a>
              </p>
            )}
            <p className="auth-switch">
              {isStaff
                ? isLogin
                  ? "Have a staff invitation?"
                  : "Already have staff access?"
                : isLogin
                  ? "New to TickShow?"
                  : "Already have an account?"}{" "}
              <a
                href={
                  isStaff
                    ? isLogin
                      ? "#/staff-invite"
                      : "#/staff-access"
                    : isLogin
                      ? `#/signup?next=${encodeURIComponent(destination)}`
                      : `#/login?next=${encodeURIComponent(destination)}`
                }
              >
                {isStaff ? (isLogin ? "Accept invitation" : "Staff login") : isLogin ? "Create account" : "Log in"}
              </a>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function TicketVerificationPage({
  reference,
  ticketId,
  token,
}: {
  reference: string | null;
  ticketId: string | null;
  token: string;
}) {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [details, setDetails] = useState<{
    event_title: string;
    event_date: string | null;
    event_venue: string | null;
    event_location: string | null;
    booking_reference: string;
    ticket_number: number;
    is_demo: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const response = ticketId
          ? await requireSupabase().rpc("verify_ticket_by_id", {
              p_ticket_id: ticketId,
              p_ticket_token: token,
            })
          : await requireSupabase().rpc("verify_storefront_ticket", {
              p_booking_reference: reference ?? "",
              p_ticket_token: token,
            });
        if (!active) return;
        if (response.error) throw new Error(response.error.message);
        const result = response.data?.[0];
        setValid(Boolean(result?.valid));
        if (result?.valid) {
          setDetails({
            event_title: result.event_title ?? "TickShow event",
            event_date: result.event_date,
            event_venue: result.event_venue,
            event_location: result.event_location,
            booking_reference: "booking_reference" in result
              ? result.booking_reference ?? reference ?? ""
              : reference ?? "",
            ticket_number: "ticket_number" in result ? result.ticket_number ?? 1 : 1,
            is_demo: "is_demo" in result ? result.is_demo : true,
          });
        } else {
          setVerificationError(
            "This ticket is invalid, revoked, or has already been checked in.",
          );
        }
      } catch {
        if (active) setVerificationError("Could not verify this ticket.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [reference, ticketId, token]);

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/events">Explore events</a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="ticket-verification-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Ticket verification</p>
            <h1 id="ticket-verification-title">
              {loading ? "Checking ticket…" : valid ? details?.is_demo ? "Valid demo ticket" : "Valid ticket" : "Ticket not valid"}
            </h1>
            {loading ? (
              <p className="auth-card-intro">Verifying the unique QR code…</p>
            ) : valid && details ? (
              <>
                <p className="auth-card-intro">{details.event_title}</p>
                <p>Ticket {details.ticket_number}</p>
                <p>{details.event_date ?? "Date to be announced"}</p>
                <p>
                  {[details.event_venue, details.event_location].filter(Boolean).join(", ") ||
                    "Venue to be announced"}
                </p>
                <p><strong>Reference:</strong> {details.booking_reference}</p>
              </>
            ) : (
              <p className="auth-error" role="alert">
                {verificationError || "This QR code is invalid or does not match a TickShow booking."}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ForgotPasswordPage() {
  const { configured, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = requestedDestination();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await requestPasswordReset(email, destination);
      setNotice("If an account exists for that email, a password reset link is on its way.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not request a reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/login">
          <Icon name="arrowLeft" size={16} /> Back to login
        </a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="reset-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Account recovery</p>
            <h1 id="reset-title">Reset your password</h1>
            <p className="auth-card-intro">We’ll email you a secure link to choose a new password.</p>
            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <button className="button button-primary auth-submit" type="submit" disabled={busy || !configured}>
                {busy ? "Sending…" : "Send reset link"} <Icon name="arrowRight" size={18} />
              </button>
            </form>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthCallbackPage() {
  const { updatePassword } = useAuth();
  const query = new URLSearchParams(window.location.search);
  const flow = query.get("flow") ?? "confirm";
  const destination = query.get("next") ?? "account";
  const [checking, setChecking] = useState(flow !== "deleted");
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (flow === "deleted") return;
    let active = true;
    const verifyLink = async () => {
      try {
        const { data, error: sessionError } = await requireSupabase().auth.getSession();
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setHasSession(Boolean(data.session));
      } catch (caught: unknown) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not verify this email link.");
        }
      } finally {
        if (active) setChecking(false);
      }
    };
    void verifyLink();
    return () => {
      active = false;
    };
  }, [flow]);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setError("");
    try {
      await updatePassword(password);
      setNotice("Password updated. You can continue to your account.");
      setHasSession(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  const safeDestination =
    destination === "admin" || destination === "account" || /^checkout\/[a-z0-9-]+$/i.test(destination)
      ? destination
      : "account";
  const continueHref = `/#/${safeDestination}`;
  const isRecovery = flow === "recovery";

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="/">
          <Icon name="arrowLeft" size={16} /> Back to home
        </a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="callback-title">
          <div className="auth-card">
            <p className="auth-card-kicker">
              {flow === "deleted" ? "Account deleted" : isRecovery ? "Password recovery" : "Email confirmation"}
            </p>
            <h1 id="callback-title">
              {flow === "deleted"
                ? "Your account is deleted"
                : isRecovery
                  ? "Choose a new password"
                  : "Confirming your email"}
            </h1>
            {flow === "deleted" ? (
              <>
                <p className="auth-card-intro">Your account and its associated bookings have been permanently deleted.</p>
                <a className="button button-primary auth-submit" href="/">Back to TickShow</a>
              </>
            ) : checking ? (
              <p className="auth-card-intro">Verifying the secure link…</p>
            ) : error ? (
              <p className="auth-error" role="alert">{error}</p>
            ) : isRecovery ? (
              hasSession ? (
                notice ? (
                  <>
                    <p className="auth-notice" role="status">{notice}</p>
                    <a className="button button-primary auth-submit" href={continueHref}>Continue</a>
                  </>
                ) : (
                  <form className="auth-form" onSubmit={changePassword}>
                    <label htmlFor="new-password">New password</label>
                    <div className="auth-password-wrap">
                      <input
                        id="new-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword((value) => !value)}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <button className="button button-primary auth-submit" type="submit" disabled={busy}>
                      {busy ? "Saving…" : "Update password"} <Icon name="arrowRight" size={18} />
                    </button>
                  </form>
                )
              ) : (
                <>
                  <p className="auth-error" role="alert">This reset link is invalid or expired. Request a new one.</p>
                  <a className="button button-primary auth-submit" href="/#/forgot-password">Request another link</a>
                </>
              )
            ) : hasSession ? (
              <>
                <p className="auth-notice" role="status">Your email is confirmed. Your account is ready.</p>
                <a className="button button-primary auth-submit" href={continueHref}>Continue</a>
              </>
            ) : (
              <>
                <p className="auth-error" role="alert">The confirmation link could not be verified. It may have expired.</p>
                <a className="button button-primary auth-submit" href="/#/login">Go to login</a>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AccountRequiredPage({ next }: { next: string }) {
  const encoded = encodeURIComponent(next);
  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/events">
          <Icon name="arrowLeft" size={16} /> Back to events
        </a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="account-required-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Your account</p>
            <h1 id="account-required-title">Sign in to continue</h1>
            <p className="auth-card-intro">Create an account or log in before booking. Your bookings will be saved to your dashboard.</p>
            <div className="account-required-actions">
              <a className="button button-primary" href={`#/signup?next=${encoded}`}>Create account</a>
              <a className="button button-dark" href={`#/login?next=${encoded}`}>Log in</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function AccountDeletedPage() {
  return (
    <div className="auth-page">
      <div className="auth-topbar"><Brand /></div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel">
          <div className="auth-card">
            <p className="auth-card-kicker">Account deleted</p>
            <h1>Your account is deleted</h1>
            <p className="auth-card-intro">Your account and its associated bookings have been permanently removed.</p>
            <a className="button button-primary auth-submit" href="/">Back to TickShow</a>
          </div>
        </section>
      </main>
    </div>
  );
}

type Route =
  | { name: "home" }
  | { name: "admin" }
  | { name: "auth"; mode: AuthMode }
  | { name: "forgot-password" }
  | { name: "auth-callback" }
  | { name: "account" }
  | { name: "account-deleted" }
  | { name: "event"; id: string }
  | { name: "checkout"; id: string }
  | { name: "order"; reference: string }
  | { name: "ticket"; reference: string | null; ticketId: string | null; token: string }
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
  if (window.location.pathname === "/auth/callback") return { name: "auth-callback" };
  const hash = window.location.hash;
  if (!hash.startsWith("#/")) return { name: "home" };
  const value = hash.slice(2).toLowerCase();
  const [path, queryString] = value.split("?");
  if (path === "admin") return { name: "admin" };
  if (path === "login" || path === "signup") return { name: "auth", mode: path };
  if (path === "staff-access") return { name: "auth", mode: "staff-login" };
  if (path === "staff-invite") return { name: "auth", mode: "staff-signup" };
  if (path === "forgot-password") return { name: "forgot-password" };
  if (path === "account") return { name: "account" };
  if (path === "account-deleted") return { name: "account-deleted" };
  if (path.startsWith("event/")) {
    return { name: "event", id: decodeURIComponent(path.slice("event/".length)) };
  }
  if (path.startsWith("checkout/")) {
    return { name: "checkout", id: decodeURIComponent(path.slice("checkout/".length)) };
  }
  if (path.startsWith("order/")) {
    return { name: "order", reference: decodeURIComponent(path.slice("order/".length)) };
  }
  if (path.startsWith("ticket/")) {
    const query = new URLSearchParams(queryString ?? "");
    const ticketPath = path.slice("ticket/".length);
    const legacyReference = ticketPath.startsWith("ts-");
    return {
      name: "ticket",
      reference: legacyReference ? decodeURIComponent(ticketPath).toUpperCase() : null,
      ticketId: legacyReference ? null : decodeURIComponent(ticketPath),
      token: query.get("v") ?? "",
    };
  }
  if (FOOTER_ROUTES.includes(path as FooterPageKey)) {
    return { name: "page", page: path as FooterPageKey };
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
  const { user, loading: authLoading } = useAuth();

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

  if (route.name === "auth") {
    return <AuthPage key={route.mode} mode={route.mode} />;
  }
  if (route.name === "forgot-password") {
    return <ForgotPasswordPage />;
  }
  if (route.name === "auth-callback") {
    return <AuthCallbackPage />;
  }
  if (route.name === "account-deleted") {
    return <AccountDeletedPage />;
  }
  if (route.name === "account") {
    if (authLoading) return <div className="account-empty">Loading account…</div>;
    return user ? <AccountDashboard /> : <AccountRequiredPage next="account" />;
  }
  if (route.name === "admin") {
    return <AdminPanel />;
  }
  if (route.name === "ticket") {
    return (
      <TicketVerificationPage
        reference={route.reference}
        ticketId={route.ticketId}
        token={route.token}
      />
    );
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
      authLoading ? (
        <div className="account-empty">Checking your account…</div>
      ) : user ? (
        <CheckoutPage event={checkoutEvent} isPast={checkoutEvent.showcaseGroup === "past"} />
      ) : (
        <AccountRequiredPage next={`checkout/${checkoutEvent.id}`} />
      )
    ) : <FooterPage page="events" events={liveEvents} onOpenEvent={openEvent} />;
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