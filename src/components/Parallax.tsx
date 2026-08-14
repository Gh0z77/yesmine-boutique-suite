import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One pointer/scroll subscription for the whole hero.
 *
 * Each layer used to attach its own listeners and its own rAF, so a single
 * mouse move woke six React renders. Now the window is read once per frame and
 * every layer reads the same snapshot.
 */
type Signal = { x: number; y: number; scroll: number };

let signal: Signal = { x: 0, y: 0, scroll: 0 };
let pending = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const schedule = (next: Signal) => {
  if (pending) return;
  pending = window.requestAnimationFrame(() => {
    pending = 0;
    signal = next;
    emit();
  });
};

let latest: Signal = signal;

const onPointer = (e: PointerEvent) => {
  // -1 … 1 across the viewport, so layers can lean toward the cursor.
  latest = {
    ...latest,
    x: (e.clientX / window.innerWidth) * 2 - 1,
    y: (e.clientY / window.innerHeight) * 2 - 1,
  };
  schedule(latest);
};

const onScroll = () => {
  latest = { ...latest, scroll: window.scrollY };
  schedule(latest);
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    latest = { x: 0, y: 0, scroll: window.scrollY };
    signal = latest;
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      if (pending) window.cancelAnimationFrame(pending);
      pending = 0;
    }
  };
}

const STILL: Signal = { x: 0, y: 0, scroll: 0 };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

function useSignal(enabled: boolean): Signal {
  const value = useSyncExternalStore(
    subscribe,
    () => signal,
    () => STILL, // server render: everything sits at rest
  );
  return enabled ? value : STILL;
}

type SceneProps = {
  children: ReactNode;
  className?: string;
  /** Perspective depth in px — smaller feels more dramatic. */
  depth?: number;
};

/** Establishes the 3D space the layers inside translate within. */
export function ParallaxScene({ children, className, depth = 1200 }: SceneProps) {
  const reduced = usePrefersReducedMotion();
  const { x, y } = useSignal(!reduced);

  return (
    <div
      className={cn("[transform-style:preserve-3d]", className)}
      style={{
        perspective: `${depth}px`,
        transform: reduced ? undefined : `rotateY(${x * 3}deg) rotateX(${-y * 2}deg)`,
        transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

type LayerProps = {
  children: ReactNode;
  className?: string;
  /** How far the layer sits from the viewer. Positive floats toward you. */
  z?: number;
  /** Pointer sensitivity in px. */
  strength?: number;
  /** Scroll sensitivity — fraction of scrollY applied as vertical drift. */
  scrollFactor?: number;
};

export function ParallaxLayer({
  children,
  className,
  z = 0,
  strength = 12,
  scrollFactor = 0,
}: LayerProps) {
  const reduced = usePrefersReducedMotion();
  const { x, y, scroll } = useSignal(!reduced);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn("will-change-transform", className)}
      style={{
        transform: `translate3d(${x * strength}px, ${y * strength * 0.6 - scroll * scrollFactor}px, ${z}px)`,
        transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}
