"use client";

import { motion, useMotionTemplate, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Footer reveal - sticky under-page footer that fades, scales and sharpens
 * as scroll uncovers it.
 *
 * A page cover sits at z-index 1. The footer sticks underneath at z-index -1
 * as a lime plane (the site accent, kept from the existing palette). Opacity,
 * scale and blur stay at 0 / 0.9 / 6px until the cover's bottom meets the
 * viewport bottom, then scrub to 1 / 1 / 0 across one footer-height of scroll.
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
  const [revealAt, setRevealAt] = useState(0.35);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const update = () => {
      const footerHeight = footer.offsetHeight;
      const viewportHeight = window.innerHeight || 1;
      setRevealAt(
        Math.min(0.95, Math.max(0.05, footerHeight / viewportHeight)),
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(footer);
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
  const opacity = useTransform(scrollYProgress, [0, revealAt], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, revealAt], [0.9, 1]);
  const blur = useTransform(scrollYProgress, [0, revealAt], [6, 0]);
  const filter = useMotionTemplate`blur(${blur}px)`;
  const opacityWillChange = useTransform(scrollYProgress, (progress) =>
    progress > 0.0001 && progress < revealAt ? "opacity" : "auto",
  );
  const contentWillChange = useTransform(scrollYProgress, (progress) =>
    progress > 0.0001 && progress < revealAt ? "transform, filter" : "auto",
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
        --footer-field: var(--accent);
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
        z-index: 1;
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
        background: var(--paper);
      }

      #tickshow-footer-reveal .reveal-footer {
        position: sticky;
        bottom: 0;
        z-index: -1;
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
        width: min(calc(100% - 56px), 1080px);
        padding-block: 72px calc(48px + env(safe-area-inset-bottom, 0px));
      }

      #tickshow-footer-reveal .site-footer .brand,
      #tickshow-footer-reveal .site-footer .brand-mark,
      #tickshow-footer-reveal .site-footer .brand-word span:last-child {
        color: var(--footer-ink);
      }

      #tickshow-footer-reveal .site-footer .footer-main {
        padding-bottom: 40px;
        border-bottom: 1px solid var(--footer-rule);
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
          width: min(calc(100% - 40px), 1080px);
          padding-block: 56px calc(40px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          gap: 28px 20px;
        }
      }

      @media (max-height: 720px) {
        /* A tall sticky footer clips its own top on short screens. Let it flow,
           and keep social links in the always-visible bottom row instead. */
        #tickshow-footer-reveal .reveal-footer {
          position: relative;
          bottom: auto;
          z-index: 1;
        }

        #tickshow-footer-reveal .site-footer .page-wrap {
          padding-block: 40px calc(32px + env(safe-area-inset-bottom, 0px));
        }

        #tickshow-footer-reveal .site-footer .footer-main {
          padding-bottom: 24px;
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
