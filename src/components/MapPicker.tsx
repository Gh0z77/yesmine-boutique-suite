import { MapPin, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TILE = 256;

const lngToX = (lng: number, z: number) => ((lng + 180) / 360) * Math.pow(2, z);
const latToY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
};
const xToLng = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180;
const yToLat = (y: number, z: number) => {
  const n = Math.PI - 2 * Math.PI * (y / Math.pow(2, z));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

type Props = {
  lat: number;
  lng: number;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
  /** Locks panning so the pin keeps marking the exact recorded point. */
  readOnly?: boolean;
  initialZoom?: number;
};

/**
 * Lightweight slippy map built on OpenStreetMap raster tiles.
 * Drag to pan (the centre pin marks the delivery point), scroll buttons to zoom.
 */
export function MapPicker({
  lat,
  lng,
  onChange,
  className,
  readOnly = false,
  initialZoom = 13,
}: Props) {
  const [zoom, setZoom] = useState(initialZoom);
  const [size, setSize] = useState({ w: 640, h: 320 });
  // Tiles are positioned from the box's measured width, which only exists in
  // a browser. Rendering them on the server produced coordinates computed
  // from a guessed 640px, and the real measurement moved every tile a
  // fraction of a pixel — React reported a mismatch on all sixteen of them.
  // The map is a browser widget; it now starts once there is a box to measure.
  const [measured, setMeasured] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      setSize({ w: node.clientWidth, h: node.clientHeight });
      setMeasured(true);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const centerX = lngToX(lng, zoom);
  const centerY = latToY(lat, zoom);
  const originX = centerX * TILE - size.w / 2;
  const originY = centerY * TILE - size.h / 2;

  const startTileX = Math.floor(originX / TILE);
  const startTileY = Math.floor(originY / TILE);
  const cols = Math.ceil(size.w / TILE) + 2;
  const rows = Math.ceil(size.h / TILE) + 2;
  const max = Math.pow(2, zoom);

  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const tx = startTileX + i;
      const ty = startTileY + j;
      if (ty < 0 || ty >= max) continue;
      const wrapped = ((tx % max) + max) % max;
      tiles.push({
        key: `${tx}-${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      });
    }
  }

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragState.current = { x: e.clientX, y: e.clientY, lat, lng };
      setDragging(true);
    },
    [lat, lng],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const dx = e.clientX - state.x;
      const dy = e.clientY - state.y;
      const cx = lngToX(state.lng, zoom) - dx / TILE;
      const cy = latToY(state.lat, zoom) - dy / TILE;
      onChange({
        lat: Math.max(-85, Math.min(85, yToLat(cy, zoom))),
        lng: ((((xToLng(cx, zoom) + 180) % 360) + 360) % 360) - 180,
      });
    },
    [zoom, onChange],
  );

  const endDrag = useCallback(() => {
    dragState.current = null;
    setDragging(false);
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        {...(readOnly
          ? {}
          : {
              onPointerDown,
              onPointerMove,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
            })}
        className={cn(
          "relative h-72 w-full touch-none select-none overflow-hidden rounded-2xl border bg-muted",
          readOnly ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {measured
          ? tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute h-64 w-64"
                style={{ left: tile.left, top: tile.top }}
              />
            ))
          : null}

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="h-10 w-10 text-primary drop-shadow-lg" strokeWidth={2.5} />
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => setZoom((z) => Math.min(18, z + 1))}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => setZoom((z) => Math.max(3, z - 1))}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        <div className="absolute bottom-1 right-2 rounded bg-card/80 px-1.5 text-[10px] text-muted-foreground">
          © OpenStreetMap
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
