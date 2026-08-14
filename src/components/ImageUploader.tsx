import { GripVertical, ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "media";
// Telefon surati ko'pincha 5 MB dan katta bo'ladi va iPhone HEIC saqlaydi —
// eski chegara shu ikki sababdan yuklashni jimgina rad etardi.
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,.heic,.heif";

/** Uploads one file to the media bucket and returns its public URL. */
async function uploadOne(file: File, folder: string): Promise<string> {
  // Ba'zi brauzerlar HEIC uchun MIME turini bo'sh qoldiradi, shuning uchun
  // kengaytma ham tekshiriladi.
  const heic = /\.(heic|heif)$/i.test(file.name);
  if (!file.type.startsWith("image/") && !heic)
    throw new Error(`"${file.name}" rasm emas.`);
  if (file.size > MAX_BYTES)
    throw new Error(
      `"${file.name}" juda katta (${Math.round(file.size / 1024 / 1024)} MB). Chegara 50 MB.`,
    );

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${folder}/${unique}.${extension || "jpg"}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

type Props = {
  /** Ordered list of image URLs. The first one is used as the main photo. */
  value: string[];
  onChange: (next: string[]) => void;
  folder: string;
  /** 1 turns the control into a single-image picker. */
  max?: number;
  label?: string;
  hint?: string;
};

export function ImageUploader({ value, onChange, folder, max = 8, label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const single = max === 1;
  const room = Math.max(0, max - value.length);

  const accept = async (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;
    if (room === 0) {
      toast.error(single ? "Avval hozirgi rasmni o'chiring." : `Ko'pi bilan ${max} ta rasm.`);
      return;
    }

    setBusy(true);
    const uploaded: string[] = [];
    for (const file of list.slice(0, room)) {
      try {
        uploaded.push(await uploadOne(file, folder));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi");
      }
    }
    setBusy(false);

    if (uploaded.length > 0) {
      onChange(single ? uploaded.slice(0, 1) : [...value, ...uploaded]);
      toast.success(`${uploaded.length} ta rasm yuklandi`);
    }
    if (list.length > room) toast.error(`${list.length - room} ta fayl o'tkazib yuborildi — chegara ${max} ta.`);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.error("http bilan boshlanadigan to'liq havola kiriting.");
      return;
    }
    if (room === 0) {
      toast.error(single ? "Remove the current image first." : `Only ${max} images allowed.`);
      return;
    }
    onChange(single ? [url] : [...value, url]);
    setUrlDraft("");
    setShowUrl(false);
  };

  return (
    <div className="space-y-3">
      {label ? <p className="text-sm font-medium">{label}</p> : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void accept(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-accent"
            : "border-border hover:border-primary/50 hover:bg-accent/40",
          busy && "pointer-events-none opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <Upload className="h-6 w-6 text-primary" />
        )}
        <p className="text-sm font-medium">
          {busy ? "Uploading…" : single ? "Choose an image" : "Drop images here or click to choose"}
        </p>
        <p className="text-xs text-muted-foreground">
          {hint ?? `JPG, PNG, WEBP or AVIF · up to 5 MB${single ? "" : ` · ${max} images max`}`}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void accept(e.target.files);
          e.target.value = "";
        }}
      />

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex items-center gap-3 rounded-2xl border bg-card p-2"
            >
              <img
                src={url}
                alt=""
                className="h-16 w-14 shrink-0 rounded-xl bg-muted object-cover"
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.25";
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{url}</p>
                {!single && index === 0 ? (
                  <p className="text-xs font-medium text-primary">Main photo</p>
                ) : null}
              </div>
              {!single && value.length > 1 ? (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    className="px-1 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === value.length - 1}
                    onClick={() => move(index, index + 1)}
                    className="px-1 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              ) : (
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove image"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {showUrl ? (
        <div className="flex gap-2">
          <Input
            value={urlDraft}
            placeholder="https://…"
            maxLength={500}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <Button variant="soft" size="sm" onClick={addUrl}>
            <ImagePlus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowUrl(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <Link2 className="h-3.5 w-3.5" /> or paste an image link instead
        </button>
      )}
    </div>
  );
}
