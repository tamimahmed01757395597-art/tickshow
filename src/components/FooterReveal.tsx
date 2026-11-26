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

      @media (max-width: 640px) {
        #tickshow-footer-reveal .site-footer .page-wrap {
          width: min(calc(100% - 40px), 1160px);
          padding-block: 12px calc(12px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .ticket-header {
          padding-inline: 12px;
        }

        #tickshow-footer-reveal .site-footer .ticket-body {
          padding: 12px;
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          gap: 16px 12px;
          padding-bottom: 16px;
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
