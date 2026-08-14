import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

/**
 * Fades content in as it scrolls into view.
 *
 * It renders VISIBLE by default. An earlier version started at opacity 0 and
 * only revealed itself once React had hydrated, so the server sent a complete
 * page that the browser painted blank for as long as the JavaScript took to
 * arrive. Everything above the fold shows immediately; only elements starting
 * below the fold are hidden and animate on approach.
 *
 * The classes are added to the node directly instead of through React state.
 * Going through state meant the very first client render produced a different
 * className than the server had sent, and React reported a hydration mismatch
 * and threw the whole tree away — the page was being rendered twice. An
 * animation is a property of the DOM node, not of what the component returns,
 * so React's output now stays identical to the server's on every render and
 * hydration has nothing to disagree about.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const ref = useRef<HTMLElement | null>(null);

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

        node.style.transitionDelay = `${delay}ms`;
        node.classList.add("reveal");

        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                node.classList.add("reveal-in");
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
  }, [delay]);

  const Tag = as as "div";
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
