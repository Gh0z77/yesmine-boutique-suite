import { AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type VariantRow = { size: string; color: string; stock: number };

/** Builds every size × colour pair, keeping stock already entered for a pair. */
export function buildGrid(sizes: string[], colors: string[], existing: VariantRow[]): VariantRow[] {
  const rows = sizes.length > 0 ? sizes : [""];
  const cols = colors.length > 0 ? colors : [""];
  const previous = new Map(existing.map((v) => [`${v.size}::${v.color}`, v.stock]));

  return rows.flatMap((size) =>
    cols.map((color) => ({
      size,
      color,
      stock: previous.get(`${size}::${color}`) ?? 0,
    })),
  );
}

type Props = {
  sizes: string[];
  colors: string[];
  value: VariantRow[];
  onChange: (next: VariantRow[]) => void;
};

/**
 * The stock matrix. One number per size + colour, because a rail with three
 * XL and no XS is the normal state of a clothing shop.
 */
export function VariantGrid({ sizes, colors, value, onChange }: Props) {
  const rows = sizes.length > 0 ? sizes : [""];
  const cols = colors.length > 0 ? colors : [""];
  const total = value.reduce((n, v) => n + v.stock, 0);

  const at = (size: string, color: string) =>
    value.find((v) => v.size === size && v.color === color)?.stock ?? 0;

  const set = (size: string, color: string, stock: number) => {
    const next = value.filter((v) => !(v.size === size && v.color === color));
    next.push({ size, color, stock: Math.max(0, stock) });
    onChange(next);
  };

  if (sizes.length === 0 && colors.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4" /> Add sizes or colours above to set stock per variant.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Stock per size and colour</p>
        <p className="text-sm text-muted-foreground">
          {total} in total · {value.filter((v) => v.stock > 0).length}/{value.length} combinations
          available
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3 text-left">Size</th>
              {cols.map((color) => (
                <th key={color} className="p-3 text-left font-medium">
                  {color || "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((size) => (
              <tr key={size} className="border-t">
                <td className="p-3 font-medium">{size || "—"}</td>
                {cols.map((color) => {
                  const stock = at(size, color);
                  return (
                    <td key={color} className="p-2">
                      <Input
                        inputMode="numeric"
                        aria-label={`Stock for ${size || "one size"} ${color || "default"}`}
                        value={String(stock)}
                        className={cn("h-9 w-20", stock === 0 && "text-muted-foreground")}
                        onChange={(e) => {
                          const parsed = Number(e.target.value.replace(/\D/g, ""));
                          set(size, color, Number.isFinite(parsed) ? parsed : 0);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        A combination left at 0 shows as sold out and can't be ordered. The product total updates by
        itself.
      </p>
    </div>
  );
}
