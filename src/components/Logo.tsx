import { cn } from "@/lib/utils";

/** Circular emblem: feminine silhouette in a crescent circle + six-petal flower. */
export function YesmineEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("h-9 w-9", className)}>
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.85" />
      <path
        d="M52 14a29 29 0 1 1-9 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* silhouette profile with flowing hijab line */}
      <path
        d="M39 20c-4-4-11-4-15 1-3 4-3 9-1 13-2 1-3 3-3 5 0 6 6 10 13 10 4 0 7-1 9-3-6-1-9-4-9-8 0-3 2-5 4-7 3-3 5-8 2-11z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M24 46c-3 2-5 4-6 7h24c-2-4-6-6-11-7"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

export function PetalFlower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("h-6 w-6", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="24" cy="14" rx="5.5" ry="10" transform={`rotate(${deg} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5",
        tone === "light" ? "text-on-brand" : "text-rose-deep",
        className,
      )}
    >
      <YesmineEmblem className="h-9 w-9 shrink-0" />
      <span className="font-script text-3xl leading-none tracking-wide">Yesmine</span>
      <PetalFlower className="h-5 w-5 shrink-0 opacity-80" />
    </span>
  );
}
