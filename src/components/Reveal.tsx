import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

/**
 * Fades content in as it scrolls into view.
 *
 * It renders VISIBLE by default. The previous version started at opacity 0 and
 * only revealed itself once React had hydrated and IntersectionObserver had
 * fired — so the server sent a complete page that the browser painted blank
 * for as long as the JavaScript took to arrive. Everything above the fold now
 * shows immediately; only elements that start below the fold are hidden (after
 * mount, where nobody can see the switch) and animate on approach.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    let observer: IntersectionObserver | undefined;
    // Two frames, so stylesheets and layout have settled before we measure —
    // reading position too early puts every section "above the fold" and no
    // animation ever runs.
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;

        // Already on screen: leave it alone rather than hide it and fade back in.
        if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return;

        setState("hidden");
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                setState("shown");
                observer?.disconnect();
              }
            }
          },
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
        );
        observer.observe(node);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      style={state === "static" ? undefined : { transitionDelay: `${delay}ms` }}
      className={cn(state !== "static" && "reveal", state === "shown" && "reveal-in", className)}
    >
      {children}
    </Tag>
  );
}
