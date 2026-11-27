"use client";

import { motion, useMotionTemplate, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Footer reveal - sticky under-page footer that fades, scales and sharpens
 * as scroll uncovers it.
 *
 * A page cover sits above the footer. The footer sticks underneath as a lime
 * plane (the site accent, kept from the existing palette). Opacity, scale and
 * blur stay at 0 / 0.9 / 6px until the cover's bottom meets the viewport
 * bottom, then scrub to 1 / 1 / 0 across one footer-height of scroll. A shared
 * normalized progress keeps all three effects in sync on every screen size.
 */
export default function FooterReveal({
  content,
  footer,
}: {
  content: ReactNode;
  footer: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const revealAtRef = useRef(0.35);

  useLayoutEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl) return;

    const update = () => {
      const footerHeight = footerEl.offsetHeight;
      const viewportHeight = window.innerHeight || 1;
      revealAtRef.current = Math.min(
        0.95,
        Math.max(0.05, footerHeight / viewportHeight),
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(footerEl);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: contentRef,
    offset: ["end end", "end start"],
  });
  const revealProgress = useTransform(scrollYProgress, (progress) => {
    const end = revealAtRef.current;
    return end > 0 ? Math.min(1, Math.max(0, progress / end)) : 1;
  });
  const opacity = useTransform(revealProgress, [0, 1], [0, 1]);
  const scale = useTransform(revealProgress, [0, 1], [0.9, 1]);
  const blur = useTransform(revealProgress, [0, 1], [6, 0]);
  const filter = useMotionTemplate`blur(${blur}px)`;
  const opacityWillChange = useTransform(revealProgress, (progress) =>
    progress > 0.0001 && progress < 1 ? "opacity" : "auto",
  );
  const contentWillChange = useTransform(revealProgress, (progress) =>
    progress > 0.0001 && progress < 1 ? "transform, filter" : "auto",
  );

  return (
    <div id="tickshow-footer-reveal" className="velocity-footer-reveal">
      <div ref={contentRef} className="content">
        {content}
      </div>

      {/* class must not be bare `footer` - that hits the site `.footer` rule. */}
      <footer ref={footerRef} className="reveal-footer">
        <motion.div
          className="footer-fade"
          style={{ opacity, willChange: opacityWillChange }}
        >
          <motion.div
            className="footer-scale"
            style={{
              scale,
              filter,
              transformOrigin: "50% 100%",
              willChange: contentWillChange,
            }}
          >
            {footer}
          </motion.div>
        </motion.div>
      </footer>

      <StyleSheet />
    </div>
  );
}

/**
 * ==============   Styles   ================
 *
 * Kept inline like the source example. All colours come from the app's
 * existing CSS variables so the reveal inherits the current lime palette.
 */

function StyleSheet() {
  return (
    <style>{`
      html:has(#tickshow-footer-reveal.velocity-footer-reveal) {
        scrollbar-width: none;
      }

      html:has(#tickshow-footer-reveal.velocity-footer-reveal)::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }

      #tickshow-footer-reveal.velocity-footer-reveal {
        --footer-field: color-mix(in srgb, var(--accent) 92%, #000);
        --footer-ink: #040e0e;
        --footer-ink-feint: color-mix(in srgb, var(--footer-ink) 62%, transparent);
        --footer-rule: color-mix(in srgb, var(--footer-ink) 18%, transparent);
        --footer-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

        position: relative;
        isolation: isolate;
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
        overflow-y: visible;
        color: var(--ink);
        background: var(--paper);
      }

      #tickshow-footer-reveal .content {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
        background: var(--paper);
      }

      #tickshow-footer-reveal .reveal-footer {
        position: sticky;
        bottom: 0;
        z-index: 0;
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 0;
        overflow-x: clip;
        background: none;
      }

      #tickshow-footer-reveal .footer-fade {
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
        background: var(--footer-field);
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .footer-scale {
        width: 100%;
        max-width: 100%;
      }

      #tickshow-footer-reveal .site-footer {
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .site-footer .page-wrap {
        box-sizing: border-box;
        width: min(calc(100% - 56px), 1160px);
        padding-block: 12px calc(12px + env(safe-area-inset-bottom, 0px));
      }

      #tickshow-footer-reveal .site-footer .footer-ticket {
        border-color: rgba(255, 255, 255, 0.45) color-mix(in srgb, var(--footer-ink) 22%, transparent)
          color-mix(in srgb, var(--footer-ink) 22%, transparent) rgba(255, 255, 255, 0.45);
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.24) 0%,
          rgba(255, 255, 255, 0.08) 48%,
          rgba(255, 255, 255, 0.16) 100%
        );
        box-shadow:
          inset 1px 1px 0 rgba(255, 255, 255, 0.5),
          inset -1px -1px 0 rgba(4, 14, 14, 0.22),
          0 2px 0 rgba(4, 14, 14, 0.18),
          0 6px 0 rgba(4, 14, 14, 0.08),
          0 24px 60px rgba(4, 14, 14, 0.2);
      }

      #tickshow-footer-reveal .site-footer .footer-ticket::before,
      #tickshow-footer-reveal .site-footer .footer-ticket::after {
        background: var(--footer-field);
      }

      #tickshow-footer-reveal .site-footer .ticket-header {
        border-bottom-color: var(--footer-rule);
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .site-footer .ticket-barcode {
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .site-footer .brand,
      #tickshow-footer-reveal .site-footer .brand-mark,
      #tickshow-footer-reveal .site-footer .brand-word span:last-child {
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .site-footer .footer-main {
        padding-bottom: 16px;
        border-bottom: 1px dashed var(--footer-rule);
      }

      #tickshow-footer-reveal .site-footer .footer-brand-block p {
        color: var(--footer-ink-feint);
      }

      #tickshow-footer-reveal .site-footer .social-links a {
        color: var(--footer-ink);
        font-weight: 500;
      }

      #tickshow-footer-reveal .site-footer .social-links a:hover,
      #tickshow-footer-reveal .site-footer .footer-link-column a:hover,
      #tickshow-footer-reveal .site-footer .footer-link-column button:hover,
      #tickshow-footer-reveal .site-footer .footer-bottom a:hover {
        color: color-mix(in srgb, var(--footer-ink) 70%, white);
      }

      #tickshow-footer-reveal .site-footer .footer-link-column h2 {
        margin-bottom: 2px;
        font-family: var(--footer-mono);
        font-size: 11px;
        font-weight: 560;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--footer-ink-feint);
      }

      #tickshow-footer-reveal .site-footer .footer-link-column a,
      #tickshow-footer-reveal .site-footer .footer-link-column button {
        color: var(--footer-ink);
        font-size: 15px;
        font-weight: 560;
      }

      #tickshow-footer-reveal .site-footer .footer-bottom {
        font-family: var(--footer-mono);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--footer-ink-feint);
      }

      #tickshow-footer-reveal .site-footer .footer-bottom a,
      #tickshow-footer-reveal .site-footer .footer-motto {
        color: var(--footer-ink);
        font-weight: 560;
      }

      #tickshow-footer-reveal .site-footer .footer-mobile-help,
      #tickshow-footer-reveal .site-footer .footer-link-arrow,
      #tickshow-footer-reveal .site-footer .social-link-mark {
        display: none;
      }

      @media (max-width: 900px) and (min-width: 641px) {
        #tickshow-footer-reveal .site-footer .page-wrap {
          width: min(calc(100% - 40px), 760px);
          padding-block: 8px calc(8px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .footer-ticket {
          border-radius: 20px;
        }

        #tickshow-footer-reveal .site-footer .ticket-body {
          padding: 12px;
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          gap: 12px;
          padding-bottom: 12px;
        }

        #tickshow-footer-reveal .site-footer .footer-brand-block p {
          margin-block: 6px;
          font-size: 13px;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column h2 {
          margin-bottom: 0;
          font-size: 10px;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column a,
        #tickshow-footer-reveal .site-footer .footer-link-column button {
          min-height: 36px;
          font-size: 13px;
        }

        #tickshow-footer-reveal .site-footer .footer-bottom {
          gap: 6px 10px;
          padding-top: 8px;
          font-size: 10px;
        }

        #tickshow-footer-reveal .site-footer .footer-bottom a {
          min-height: 36px;
        }
      }

      @media (max-width: 640px) {
        #tickshow-footer-reveal .site-footer .page-wrap {
          width: min(calc(100% - 32px), 560px);
          padding-block: 10px calc(10px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .footer-ticket {
          border: 1px solid color-mix(in srgb, var(--footer-ink) 24%, transparent);
          border-radius: 22px;
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.035) 72%
          );
        }

        #tickshow-footer-reveal .site-footer .footer-ticket::before,
        #tickshow-footer-reveal .site-footer .footer-ticket::after,
        #tickshow-footer-reveal .site-footer .ticket-header {
          display: none;
        }

        #tickshow-footer-reveal .site-footer .ticket-body {
          padding: 12px 12px;
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          padding-bottom: 10px;
        }

        #tickshow-footer-reveal .site-footer .footer-brand-block {
          display: flex;
          grid-column: 1 / -1;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 2px 10px;
          border-bottom: 1px dashed var(--footer-rule);
        }

        #tickshow-footer-reveal .site-footer .footer-brand-block > .social-links {
          display: none;
        }

        #tickshow-footer-reveal .site-footer .footer-mobile-help {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid color-mix(in srgb, var(--footer-ink) 22%, transparent);
          border-radius: 14px;
          background: color-mix(in srgb, var(--footer-field) 45%, transparent);
          color: var(--footer-ink);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column {
          min-width: 0;
          align-items: stretch;
          gap: 6px;
          padding: 0;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column h2 {
          margin: 0 0 2px;
          font-size: 10px;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column a,
        #tickshow-footer-reveal .site-footer .footer-link-column button {
          display: flex;
          width: 100%;
          min-width: 0;
          min-height: 36px;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          padding: 4px 8px;
          border: 1px solid color-mix(in srgb, var(--footer-ink) 10%, transparent);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.14);
          font-size: 12px;
          line-height: 1.3;
          text-align: left;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column a > span {
          min-width: 0;
        }

        #tickshow-footer-reveal .site-footer .footer-link-arrow {
          display: block;
          flex: 0 0 auto;
          color: var(--accent);
        }

        #tickshow-footer-reveal .site-footer .footer-link-column:last-child {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #tickshow-footer-reveal .site-footer .footer-link-column:last-child h2 {
          grid-column: 1 / -1;
        }

        #tickshow-footer-reveal .site-footer .footer-bottom {
          align-items: center;
          flex-direction: column;
          gap: 8px;
          padding-top: 10px;
          text-align: center;
        }

        #tickshow-footer-reveal .site-footer .footer-bottom-copy {
          order: 2;
          align-items: center;
        }

        #tickshow-footer-reveal .site-footer .ticket-barcode {
          display: none;
        }

        #tickshow-footer-reveal .site-footer .footer-social-compact {
          display: flex;
          order: 1;
          justify-content: center;
          gap: 10px;
        }

        #tickshow-footer-reveal .site-footer .footer-social-compact a {
          width: 44px;
          min-width: 44px;
          height: 44px;
          min-height: 44px;
          justify-content: center;
          border: 1px solid color-mix(in srgb, var(--footer-ink) 18%, transparent);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.055);
          font-size: 0;
        }

        #tickshow-footer-reveal .site-footer .footer-social-compact .social-link-label {
          display: none;
        }

        #tickshow-footer-reveal .site-footer .footer-social-compact .social-link-mark {
          display: inline-flex;
          font-family: var(--footer-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        #tickshow-footer-reveal .site-footer .footer-bottom > a {
          order: 3;
          justify-content: center;
          min-height: 36px;
          padding-inline: 8px;
        }

        #tickshow-footer-reveal .site-footer .footer-link-column a,
        #tickshow-footer-reveal .site-footer .footer-link-column button {
          font-size: 12px;
        }
      }

      @media (max-height: 720px) {
        /* A tall sticky footer clips its own top on short screens. Let it flow,
           and keep social links in the always-visible bottom row instead. */
        #tickshow-footer-reveal .reveal-footer {
          position: relative;
          bottom: auto;
          z-index: 0;
        }

        #tickshow-footer-reveal .site-footer .page-wrap {
          padding-block: 8px calc(8px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .ticket-body {
          padding: 8px;
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          padding-bottom: 16px;
        }

        #tickshow-footer-reveal .site-footer .footer-brand-block .social-links {
          display: none;
        }

        #tickshow-footer-reveal .site-footer .footer-social-compact {
          display: flex;
        }
      }
    `}</style>
  );
}
