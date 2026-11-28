import { useEffect, useMemo, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import * as api from "../lib/admin";
import type { ShowcaseRecord } from "../lib/admin";
import { requireSupabase } from "../lib/supabase";
import {
  DEFAULT_TICKET_DESIGN,
  normalizeTicketDesign,
  ticketDesignToJson,
  type TicketDesign,
} from "../lib/ticket-design";
import "./TicketDesignSection.css";

function useFilePreview(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function TicketPreview({
  event,
  design,
  backgroundUrl,
  logoUrl,
  qrUrl,
  large = false,
}: {
  event: ShowcaseRecord;
  design: TicketDesign;
  backgroundUrl: string;
  logoUrl: string;
  qrUrl: string;
  large?: boolean;
}) {
  const style = {
    "--ticket-background": design.backgroundColor,
    "--ticket-primary": design.primaryColor,
    "--ticket-secondary": design.secondaryColor,
    "--ticket-align": design.textAlign,
    backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
  } as CSSProperties;
  const title = design.title.trim() || event.title;
  const facts = [
    ...(design.showEventDate && event.date_label ? [["Date", event.date_label]] : []),
    ...(design.showEventTime && event.time_label ? [["Time", event.time_label]] : []),
    ...(design.showVenue && event.venue ? [["Venue", event.venue]] : []),
    ...(design.showGuestName ? [["Guest", "Alex Morgan"]] : []),
    ...(design.showBookingReference ? [["Reference", "TS-PREVIEW123"]] : []),
    ["Ticket", "1 of 2"],
  ];

  return (
    <article
      className={`ticket-preview${large ? " is-large" : ""}`}
      style={style}
      aria-label="Live ticket preview"
    >
      <header className="ticket-preview-header">
        <div className="ticket-preview-brand">
          {logoUrl && <img src={logoUrl} alt="Event logo" />}
          <strong>TICKSHOW</strong>
        </div>
        <h3 style={{ fontSize: `${design.fontSize}px` }}>{title}</h3>
        {design.subtitle && <p>{design.subtitle}</p>}
      </header>
      <dl className="ticket-preview-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={`ticket-preview-code is-${design.qrPosition}`}>
        <div className="ticket-preview-qr" style={{ width: `${(design.qrSize / 105) * 100}%` }}>
          {qrUrl && <img src={qrUrl} alt="Preview-only QR code" />}
        </div>
        <small>Preview only · not an entry ticket</small>
      </div>
      {design.footerText && <footer className="ticket-preview-footer">{design.footerText}</footer>}
    </article>
  );
}

export default function TicketDesignSection() {
  const [events, setEvents] = useState<ShowcaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [design, setDesign] = useState<TicketDesign>({ ...DEFAULT_TICKET_DESIGN });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [clearLegacyBackground, setClearLegacyBackground] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );
  const logoFileUrl = useFilePreview(logoFile);
  const backgroundFileUrl = useFilePreview(backgroundFile);

  useEffect(() => {
    let active = true;
    api.fetchShowcase()
      .then((rows) => {
        if (!active) return;
        setEvents(rows);
        setSelectedId((current) => current || rows[0]?.id || "");
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    try {
      setDesign(normalizeTicketDesign(selected.ticket_design));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not read the saved ticket design.");
    }
    setLogoFile(null);
    setBackgroundFile(null);
    setClearLegacyBackground(false);
    setNotice("");
  }, [selected?.id]);

  useEffect(() => {
    let active = true;
    const loadAssets = async () => {
      try {
        const [logo, background] = await Promise.all([
          design.logoPath ? api.getTicketDesignAssetUrl(design.logoPath) : Promise.resolve(""),
          design.backgroundImagePath
            ? api.getTicketDesignAssetUrl(design.backgroundImagePath)
            : selected?.ticket_design_image_path && !clearLegacyBackground
              ? Promise.resolve(
                  requireSupabase().storage
                    .from("event-images")
                    .getPublicUrl(selected.ticket_design_image_path).data.publicUrl,
                )
              : Promise.resolve(""),
        ]);
        if (active) {
          setLogoUrl(logo);
          setBackgroundUrl(background);
        }
      } catch (caught: unknown) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not load ticket design images.");
        }
      }
    };
    void loadAssets();
    return () => {
      active = false;
    };
  }, [
    design.logoPath,
    design.backgroundImagePath,
    selected?.id,
    selected?.ticket_design_image_path,
    clearLegacyBackground,
  ]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL("TICKSHOW PREVIEW ONLY", {
      width: 220,
      margin: 0,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not preview QR code.");
      });
    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof TicketDesign>(key: K, value: TicketDesign[K]) => {
    setDesign((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  };

  const saveDesign = async (
    nextDesign: TicketDesign,
    clearLegacy = clearLegacyBackground,
    fileOverrides?: { logo: File | null; background: File | null },
  ) => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const uploaded: string[] = [];
    try {
      const activeLogoFile = fileOverrides ? fileOverrides.logo : logoFile;
      const activeBackgroundFile = fileOverrides ? fileOverrides.background : backgroundFile;
      const logoPath = activeLogoFile
        ? await api.uploadTicketDesignAsset(selected.id, "logo", activeLogoFile)
        : nextDesign.logoPath;
      if (activeLogoFile && logoPath) uploaded.push(logoPath);
      const backgroundImagePath = activeBackgroundFile
        ? await api.uploadTicketDesignAsset(selected.id, "background", activeBackgroundFile)
        : nextDesign.backgroundImagePath;
      if (activeBackgroundFile && backgroundImagePath) uploaded.push(backgroundImagePath);
      const saved = { ...nextDesign, logoPath, backgroundImagePath };
      await api.updateShowcaseEvent(selected.id, {
        ticket_design: ticketDesignToJson(saved),
        ticket_design_image_path: clearLegacy ? null : selected.ticket_design_image_path,
      });
      setDesign(saved);
      setLogoFile(null);
      setBackgroundFile(null);
      setClearLegacyBackground(clearLegacy);
      setEvents((current) =>
        current.map((event) =>
          event.id === selected.id
            ? {
                ...event,
                ticket_design: ticketDesignToJson(saved),
                ticket_design_image_path: clearLegacy ? null : event.ticket_design_image_path,
              }
            : event,
        ),
      );
      setNotice("Ticket design saved for this event.");
    } catch (caught: unknown) {
      const cleanupErrors: string[] = [];
      try {
        await api.deleteTicketDesignAssets(uploaded);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : "Image cleanup failed.");
      }
      const message = caught instanceof Error ? caught.message : "Could not save this ticket design.";
      setError(cleanupErrors.length ? `${message} ${cleanupErrors.join("; ")}` : message);
    } finally {
      setSaving(false);
    }
  };

  const resetDesign = async () => {
    if (!selected || saving) return;
    const defaults = { ...DEFAULT_TICKET_DESIGN };
    setDesign(defaults);
    setLogoFile(null);
    setBackgroundFile(null);
    setClearLegacyBackground(true);
    await saveDesign(defaults, true, { logo: null, background: null });
  };

  if (loading) return <div className="admin-state">Loading event designs…</div>;
  if (error && !selected) {
    return <div className="admin-state admin-state-error" role="alert">{error}</div>;
  }
  if (!events.length) return <div className="admin-state">Create a showcase event before designing a ticket.</div>;

  const previewLogo = logoFileUrl || logoUrl;
  const previewBackground = backgroundFileUrl || backgroundUrl;

  return (
    <section className="ticket-designer">
      <div className="ticket-designer-toolbar">
        <label>
          <span>Event</span>
          <select
            className="admin-select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </label>
        <p>Each event keeps its own saved ticket template.</p>
      </div>

      {error && <p className="admin-inline-error" role="alert">{error}</p>}
      {notice && <p className="ticket-design-notice" role="status">{notice}</p>}

      <div className="ticket-designer-layout">
        <div className="ticket-design-controls">
          <section className="ticket-design-card">
            <h2>Colors &amp; artwork</h2>
            <div className="ticket-design-colors">
              {([
                ["backgroundColor", "Background"],
                ["primaryColor", "Primary"],
                ["secondaryColor", "Secondary"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={design[key]}
                    onChange={(event) => setField(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <label className="ticket-design-field">
              <span>Event logo <small>JPEG or PNG, up to 10 MB</small></span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => setLogoFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            {(logoFile || design.logoPath) && (
              <button
                className="admin-button admin-button-quiet"
                type="button"
                onClick={() => {
                  setLogoFile(null);
                  setField("logoPath", null);
                }}
              >
                Remove logo
              </button>
            )}
            <label className="ticket-design-field">
              <span>Background image <small>JPEG or PNG, up to 10 MB</small></span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => setBackgroundFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            {(backgroundFile || design.backgroundImagePath || selected?.ticket_design_image_path) && (
              <button
                className="admin-button admin-button-quiet"
                type="button"
                onClick={() => {
                  setBackgroundFile(null);
                  setField("backgroundImagePath", null);
                  setClearLegacyBackground(true);
                }}
              >
                Remove background image
              </button>
            )}
          </section>

          <section className="ticket-design-card">
            <h2>Type &amp; event details</h2>
            <label className="ticket-design-field">
              <span>Ticket title</span>
              <input
                maxLength={120}
                value={design.title}
                placeholder={selected?.title}
                onChange={(event) => setField("title", event.target.value)}
              />
            </label>
            <label className="ticket-design-field">
              <span>Subtitle</span>
              <input
                maxLength={160}
                value={design.subtitle}
                onChange={(event) => setField("subtitle", event.target.value)}
              />
            </label>
            <div className="ticket-design-split">
              <label>
                <span>Font size · {design.fontSize}px</span>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={design.fontSize}
                  onChange={(event) => setField("fontSize", Number(event.target.value))}
                />
              </label>
              <label>
                <span>Text alignment</span>
                <select
                  value={design.textAlign}
                  onChange={(event) => setField("textAlign", event.target.value as TicketDesign["textAlign"])}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
            <div className="ticket-design-toggles">
              {([
                ["showEventDate", "Event date"],
                ["showEventTime", "Event time"],
                ["showVenue", "Venue"],
                ["showGuestName", "Guest name"],
                ["showBookingReference", "Booking reference"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={design[key]}
                    onChange={(event) => setField(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <section className="ticket-design-card">
            <h2>QR code &amp; footer</h2>
            <div className="ticket-design-split">
              <label>
                <span>QR position</span>
                <select
                  value={design.qrPosition}
                  onChange={(event) => setField("qrPosition", event.target.value as TicketDesign["qrPosition"])}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label>
                <span>QR size · {design.qrSize} mm</span>
                <input
                  type="range"
                  min="22"
                  max="40"
                  value={design.qrSize}
                  onChange={(event) => setField("qrSize", Number(event.target.value))}
                />
              </label>
            </div>
            <label className="ticket-design-field">
              <span>Custom footer text</span>
              <textarea
                rows={3}
                maxLength={240}
                value={design.footerText}
                onChange={(event) => setField("footerText", event.target.value)}
              />
            </label>
          </section>
          <div className="ticket-design-actions">
            <button
              className="admin-button admin-button-primary"
              type="button"
              disabled={saving}
              onClick={() => void saveDesign(design)}
            >
              {saving ? "Saving…" : "Save Design"}
            </button>
            <button
              className="admin-button admin-button-quiet"
              type="button"
              disabled={saving}
              onClick={() => setPreviewOpen(true)}
            >
              Preview Ticket
            </button>
            <button
              className="admin-button admin-button-quiet"
              type="button"
              disabled={saving}
              onClick={() => void resetDesign()}
            >
              Reset Design
            </button>
          </div>
        </div>

        <div className="ticket-design-preview-panel">
          <div className="admin-section-heading">
            <div>
              <h2>Live preview</h2>
              <p>Changes appear here immediately. Preview codes are not valid entry tickets.</p>
            </div>
          </div>
          {selected && (
            <TicketPreview
              event={selected}
              design={design}
              backgroundUrl={previewBackground}
              logoUrl={previewLogo}
              qrUrl={qrUrl}
            />
          )}
        </div>
      </div>

      {previewOpen && selected && (
        <div className="ticket-preview-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}>
          <div
            className="ticket-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Ticket preview"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="admin-button admin-button-quiet"
              type="button"
              onClick={() => setPreviewOpen(false)}
            >
              Close preview
            </button>
            <TicketPreview
              event={selected}
              design={design}
              backgroundUrl={previewBackground}
              logoUrl={previewLogo}
              qrUrl={qrUrl}
              large
            />
          </div>
        </div>
      )}
    </section>
  );
}
