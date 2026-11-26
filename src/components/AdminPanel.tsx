import { useState } from "react";
import Brand from "./Brand";
import "./AdminPanel.css";

const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview", mark: "OV" },
  { id: "events", label: "Events", mark: "EV" },
  { id: "customers", label: "Customers", mark: "CU" },
  { id: "organizers", label: "Organizers", mark: "OR" },
  { id: "orders", label: "Orders & tickets", mark: "OT" },
  { id: "payments", label: "Payments", mark: "PA" },
  { id: "payouts", label: "Payouts", mark: "PO" },
  { id: "support", label: "Support", mark: "SU" },
  { id: "activity", label: "Activity log", mark: "AL" },
  { id: "staff", label: "Staff & roles", mark: "SR" },
] as const;

type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"];

const METRICS = [
  "Registered users",
  "Customers",
  "Organizers",
  "Staff",
  "Total events",
  "Published events",
  "Pending approvals",
  "Tickets sold",
  "Successful orders",
  "Verified revenue",
  "Platform commission",
  "Pending payouts",
];

const ANALYTICS = [
  "Revenue over time",
  "Ticket sales over time",
  "User registration growth",
  "Event publication statistics",
  "Payment success and failure rates",
  "Top-performing events",
  "Top-performing organizers",
];

const SECTION_DESCRIPTIONS: Record<AdminSection, string> = {
  overview: "A real-time view of platform activity and performance.",
  events: "Review and manage event listings across TickShow.",
  customers: "Find customer accounts and review account status.",
  organizers: "Manage organizer profiles and verification.",
  orders: "Review orders, tickets, and booking issues.",
  payments: "Review payment activity and financial records.",
  payouts: "Track organizer payout requests and settlement status.",
  support: "Review customer support requests and case status.",
  activity: "Review the audit trail of administrative actions.",
  staff: "Manage administrator accounts and role assignments.",
};

function AdminPanel() {
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const active = ADMIN_SECTIONS.find((section) => section.id === activeSection)!;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <Brand />
          <span className="admin-brand-caption">PLATFORM ADMIN</span>
        </div>
        <div className="admin-nav-label">WORKSPACE</div>
        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((section) => (
            <button
              className={`admin-nav-item${activeSection === section.id ? " is-active" : ""}`}
              type="button"
              key={section.id}
              aria-current={activeSection === section.id ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="admin-nav-mark" aria-hidden="true">{section.mark}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="admin-preview-dot" aria-hidden="true" />
          <span>Preview mode</span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>TickShow</span>
            <span aria-hidden="true">/</span>
            <span>Admin</span>
            <span aria-hidden="true">/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-mode-badge">UI preview · no backend</span>
            <a className="admin-storefront-link" href="#home">Back to storefront</a>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">TICKSHOW CONTROL ROOM</p>
              <h1>{activeSection === "overview" ? "Platform overview" : active.label}</h1>
              <p className="admin-page-description">{SECTION_DESCRIPTIONS[activeSection]}</p>
            </div>
            <span className="admin-role-chip">Unauthenticated preview</span>
          </div>

          <div className="admin-connection-notice" role="status">
            <span className="admin-notice-mark" aria-hidden="true">i</span>
            <p>
              <strong>Backend not connected.</strong> This is a visual preview only. It does not
              authenticate users, read platform data, or perform administrative actions.
            </p>
          </div>

          {activeSection === "overview" ? (
            <>
              <section className="admin-section-block" aria-labelledby="admin-metrics-title">
                <div className="admin-section-heading">
                  <div>
                    <h2 id="admin-metrics-title">Platform statistics</h2>
                    <p>Live totals will appear when a verified data source is connected.</p>
                  </div>
                  <span className="admin-data-state">No data source</span>
                </div>
                <div className="admin-metric-grid">
                  {METRICS.map((metric) => (
                    <article className="admin-metric-card" key={metric}>
                      <span className="admin-metric-label">{metric}</span>
                      <strong aria-label={`${metric}: unavailable`}>—</strong>
                      <span className="admin-metric-foot">Unavailable</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-section-block" aria-labelledby="admin-analytics-title">
                <div className="admin-section-heading">
                  <div>
                    <h2 id="admin-analytics-title">Analytics</h2>
                    <p>Charts and rankings require verified database queries.</p>
                  </div>
                  <span className="admin-filter-note">Date filters unavailable in preview</span>
                </div>
                <div className="admin-analytics-grid">
                  {ANALYTICS.map((item) => (
                    <article className="admin-analytics-card" key={item}>
                      <h3>{item}</h3>
                      <div className="admin-chart-empty">
                        <span className="admin-chart-mark" aria-hidden="true">—</span>
                        <p>No connected data</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="admin-empty-section" aria-live="polite">
              <span className="admin-empty-mark" aria-hidden="true">{active.mark}</span>
              <h2>{active.label} data is not connected</h2>
              <p>
                Connect the authorized backend to view and manage {active.label.toLowerCase()}.
                Nothing on this preview changes platform records.
              </p>
              {activeSection === "staff" && (
                <p className="admin-permission-note">
                  Administrator role changes must be enforced by the server and database.
                </p>
              )}
            </section>
          )}

          <footer className="admin-footer">
            <span>TickShow Admin · UI preview</span>
            <span>No production data is shown</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default AdminPanel;
