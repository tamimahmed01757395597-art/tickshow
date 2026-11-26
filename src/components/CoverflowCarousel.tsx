import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import type { TickShowEvent } from "../data/events";

type CoverflowCarouselProps = {
  events: TickShowEvent[];
  onOpenEvent: (event: TickShowEvent) => void;
  reducedMotion?: boolean;
};

type DragState = {
  pointerId: number;
  startX: number;
  startPosition: number;
};

/** Mirrors the --cf-size breakpoint used in index.css. */
function getItemWidth() {
  if (typeof window === "undefined") return 340;
  if (window.innerWidth <= 600) return 250;
  if (window.innerWidth <= 900) return 300;
  return 340;
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    >
      {direction === "left" ? (
        <path d="M20 12H5m6-6-6 6 6 6" />
      ) : (
        <path d="M4 12h15m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}

/** The coverflow pull toward centre that Motion+'s Carousel applies on top of layout. */
function coverflowShift(offset: number, itemWidth: number) {
  const input = [-800, -200, 200, 800];
  const output = [itemWidth, 0, 0, -itemWidth];
  if (offset <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (offset <= input[i]) {
      const t = (offset - input[i - 1]) / (input[i] - input[i - 1]);
      return output[i - 1] + (output[i] - output[i - 1]) * t;
    }
  }
  return output[output.length - 1];
}

/** Local stand-in for Motion+'s useTickerItem(), driven by the shared position value. */
function CoverflowItem({
  event,
  index,
  count,
  position,
  itemWidth,
  isActive,
  onSelect,
}: {
  event: TickShowEvent;
  index: number;
  count: number;
  position: MotionValue<number>;
  itemWidth: number;
  isActive: boolean;
  onSelect: (index: number) => void;
}) {
  // Shortest circular distance keeps the coverflow filled on both sides.
  const offset = useTransform(position, (value) => {
    const half = count / 2;
    const raw = ((((index - value + half) % count) + count) % count) - half;
    return raw * itemWidth;
  });

  const { rotateY, scale } = useTransform(offset, [-200, 0, 200], {
    rotateY: [22, 0, -22],
    scale: [0.72, 1, 0.72],
  });
  // offset is the item's real position; coverflowShift adds the stacked look.
  const x = useTransform(offset, (value) => value + coverflowShift(value, itemWidth));
  const zIndex = useTransform(offset, (value) =>
    Math.max(0, Math.round(1000 - Math.abs(value))),
  );
  const opacity = useTransform(offset, [-1100, -560, 560, 1100], [0, 1, 1, 0]);

  return (
    <motion.div
      className="cf-slot"
      style={{ x: "-50%", y: "-50%", zIndex }}
      aria-hidden={!isActive}
    >
      <motion.div
        className={isActive ? "cf-card is-active" : "cf-card"}
        style={{ x, rotateY, scale, opacity, transformPerspective: 900 }}
        onClick={() => onSelect(index)}
      >
        <img
          className="cf-image"
          src={event.image}
          alt={event.imageAlt}
          draggable={false}
          decoding="async"
        />
        <span className="cf-shade" aria-hidden="true" />
        <span className="cf-tag">{event.category}</span>
      </motion.div>
    </motion.div>
  );
}

export default function CoverflowCarousel({
  events,
  onOpenEvent,
  reducedMotion = false,
}: CoverflowCarouselProps) {
  const position = useMotionValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [itemWidth, setItemWidth] = useState(getItemWidth);
  const activeRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const count = Math.max(events.length, 1);
  const eventKey = events.map((event) => event.id).join("|");

  const goTo = useCallback(
    (index: number) => {
      const target = ((index % count) + count) % count;
      const current = Math.round(position.get());
      let delta = (((target - current) % count) + count) % count;
      if (delta > count / 2) delta -= count;

      activeRef.current = target;
      setActiveIndex(target);
      animate(
        position,
        current + delta,
        reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 },
      );
    },
    [count, position, reducedMotion],
  );

  // Keep the counter, dots and caption in sync while dragging or animating.
  useEffect(() => {
    return position.on("change", (value) => {
      const next = ((Math.round(value) % count) + count) % count;
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActiveIndex(next);
      }
    });
  }, [count, position]);

  useEffect(() => {
    const onResize = () => setItemWidth(getItemWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    position.stop();
    position.set(0);
    activeRef.current = 0;
    setActiveIndex(0);
  }, [eventKey, position]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    position.stop();
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition: position.get(),
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) suppressClickRef.current = true;
    position.set(drag.startPosition - delta / itemWidth);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    goTo(Math.round(position.get()));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeRef.current + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeRef.current - 1);
    }
  };

  const active = events[activeIndex];

  const selectCard = (index: number) => {
    if (suppressClickRef.current) return;
    if (index === activeRef.current) {
      const event = events[index];
      if (event) onOpenEvent(event);
    } else {
      goTo(index);
    }
  };

  return (
    <div className="carousel cf-carousel">
      <div className="carousel-toolbar">
        <p className="cf-hint">
          Drag to revisit <span aria-hidden="true">↔</span>
        </p>
        <div className="carousel-controls">
          <span className="carousel-count">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong> /{" "}
            {String(events.length).padStart(2, "0")}
          </span>
          <button
            className="carousel-btn"
            type="button"
            onClick={() => goTo(activeRef.current - 1)}
            aria-label="Previous event"
          >
            <Arrow direction="left" />
          </button>
          <button
            className="carousel-btn"
            type="button"
            onClick={() => goTo(activeRef.current + 1)}
            aria-label="Next event"
          >
            <Arrow direction="right" />
          </button>
        </div>
      </div>

      <div
        className={dragging ? "cf-viewport is-dragging" : "cf-viewport"}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured events lineup"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className="cf-stage">
          {events.map((event, index) => (
            <CoverflowItem
              key={event.id}
              event={event}
              index={index}
              count={count}
              position={position}
              itemWidth={itemWidth}
              isActive={index === activeIndex}
              onSelect={selectCard}
            />
          ))}
        </div>
      </div>

      {active && (
        <div className="cf-caption" aria-live="polite">
          <div className="cf-caption-copy">
            <p className="cf-caption-kicker">
              {active.category} <span aria-hidden="true">·</span> {active.status}
            </p>
            <h3>{active.title}</h3>
            <p className="cf-caption-meta">
              {active.date} <span aria-hidden="true">·</span> {active.venue}{" "}
              <span aria-hidden="true">·</span> {active.location}
            </p>
          </div>
          <div className="cf-caption-side">
            <p className="cf-price">
              <span>From (BDT)</span>
              <strong>৳{active.price}</strong>
            </p>
            <button className="cf-details" type="button" onClick={() => onOpenEvent(active)}>
              View details <Arrow direction="right" />
            </button>
          </div>
        </div>
      )}

      <div className="cf-dots" aria-label="Choose a featured event">
        {events.map((event, index) => (
          <button
            key={event.id}
            type="button"
            className={index === activeIndex ? "cf-dot is-active" : "cf-dot"}
            aria-label={`Show ${event.title}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
