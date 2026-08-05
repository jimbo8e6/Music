"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { updateAvatar } from "@/lib/actions";

const OUTPUT_SIZE = 256;
const PREVIEW_SIZE = 240;

export function AvatarDisplay({
  avatarUrl,
  displayName,
  isOwner,
}: {
  avatarUrl: string | null;
  displayName: string;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string);
      setEditing(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaved = () => {
    setEditing(false);
    setImageSrc(null);
    router.refresh();
  };

  return (
    <>
      <div className="relative h-20 w-20">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-ink-800 ring-2 ring-ink-700">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`${displayName}'s avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-mist-400">
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>

        {isOwner && (
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
            aria-label="Change profile photo"
          >
            <CameraIcon />
          </button>
        )}
      </div>

      {isOwner && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {editing && imageSrc && (
        <AvatarCropModal
          imageSrc={imageSrc}
          onSaved={handleSaved}
          onCancel={() => {
            setEditing(false);
            setImageSrc(null);
          }}
        />
      )}
    </>
  );
}

function AvatarCropModal({
  imageSrc,
  onSaved,
  onCancel,
}: {
  imageSrc: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(0.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, startTransition] = useTransition();
  const imgRef = useRef<HTMLImageElement | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffX: number;
    startOffY: number;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const fit = Math.max(
        PREVIEW_SIZE / img.naturalWidth,
        PREVIEW_SIZE / img.naturalHeight,
      );
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      setScale(fit);
      setMinScale(fit);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const imgW = naturalW * scale;
  const imgH = naturalH * scale;
  const imgLeft = (PREVIEW_SIZE - imgW) / 2 + offset.x;
  const imgTop = (PREVIEW_SIZE - imgH) / 2 + offset.y;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.startOffX + e.clientX - dragRef.current.startX,
      y: dragRef.current.startOffY + e.clientY - dragRef.current.startY,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const t = e.touches[0];
    setOffset({
      x: dragRef.current.startOffX + t.clientX - dragRef.current.startX,
      y: dragRef.current.startOffY + t.clientY - dragRef.current.startY,
    });
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const ratio = OUTPUT_SIZE / PREVIEW_SIZE;
    ctx.drawImage(img, imgLeft * ratio, imgTop * ratio, imgW * ratio, imgH * ratio);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    startTransition(async () => {
      await updateAvatar(dataUrl);
      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-ink-900 border-ink-700 w-full max-w-sm space-y-5 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-mist-100 font-semibold">Adjust your photo</h2>
          <button
            onClick={onCancel}
            className="text-mist-500 hover:text-mist-200 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-mist-500 text-xs">Drag to reposition · use the slider to zoom</p>

        {/* Circular preview */}
        <div
          className="ring-ink-600 relative mx-auto cursor-move select-none overflow-hidden rounded-full ring-2"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {naturalW > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: imgLeft,
                top: imgTop,
                width: imgW,
                height: imgH,
                maxWidth: "none",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-mist-500 shrink-0 text-xs">Zoom</span>
          <input
            type="range"
            min={minScale}
            max={minScale * 4}
            step={0.001}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="accent-accent-500 w-full"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || naturalW === 0}
          className="btn btn-primary w-full"
        >
          {saving ? "Saving…" : "Save photo"}
        </button>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-white"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
