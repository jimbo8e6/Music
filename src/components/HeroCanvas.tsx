"use client";

import { useEffect, useRef } from "react";

const COVERS = [
  "#6B0F0F","#8B2020","#7A1A1A",
  "#1A1A4E","#0D2045","#1C2D6B",
  "#2C4A1E","#1E3D1A","#3A5C27",
  "#4A3200","#6B4800","#5C3D00",
  "#2A0D3A","#3D1255","#1E0A28",
  "#0A2A2A","#123030","#0D3535",
  "#1A0000","#0F0808","#280A0A",
  "#2D1A00","#3D2500","#4A3010",
  "#001A2A","#00263D","#00141F",
  "#1A2800","#243800","#1E3300",
];

interface Album {
  x: number; y: number; size: number; color: string;
  vx: number; vy: number; opacity: number;
  type: "sleeve" | "vinyl"; labelColor: string | null;
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.floor(amount * 255));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.floor(amount * 255));
  const b = Math.min(255, (n & 0xff) + Math.floor(amount * 255));
  return `rgb(${r},${g},${b})`;
}

function drawRounded(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function HeroCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let albums: Album[] = [];
    let W = 0, H = 0, dpr = 1;
    let rafId: number;
    let stopped = false;

    function init() {
      dpr = window.devicePixelRatio || 1;
      W = canvas!.offsetWidth;
      H = canvas!.offsetHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.scale(dpr, dpr);

      const count = Math.min(42, Math.floor((W * H) / 20000) + 12);
      albums = Array.from({ length: count }, () => {
        const size = 88 + Math.random() * 84;
        const color = COVERS[Math.floor(Math.random() * COVERS.length)];
        const type: "sleeve" | "vinyl" = Math.random() < 0.3 ? "vinyl" : "sleeve";
        return {
          x: Math.random() * (W + 200) - 100,
          y: Math.random() * (H + 200) - 100,
          size,
          color,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          opacity: 0.12 + Math.random() * 0.1,
          type,
          labelColor: type === "sleeve" ? lighten(color, 0.15) : null,
        };
      });
    }

    function drawAlbum(a: Album) {
      ctx!.save();
      ctx!.globalAlpha = a.opacity;
      ctx!.translate(a.x, a.y);

      if (a.type === "vinyl") {
        ctx!.beginPath();
        ctx!.arc(a.size / 2, a.size / 2, a.size / 2, 0, Math.PI * 2);
        ctx!.fillStyle = "#111";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(a.size / 2, a.size / 2, a.size * 0.2, 0, Math.PI * 2);
        ctx!.fillStyle = a.color;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(a.size / 2, a.size / 2, 3, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(0,0,0,0.8)";
        ctx!.fill();
      } else {
        drawRounded(ctx!, 0, 0, a.size, a.size, 4);
        ctx!.fillStyle = a.color;
        ctx!.fill();
        if (a.labelColor) {
          const spineH = a.size * 0.18;
          drawRounded(ctx!, 0, 0, a.size, spineH, 4);
          ctx!.fillStyle = a.labelColor;
          ctx!.fill();
        }
      }
      ctx!.restore();
    }

    function frame() {
      if (stopped) return;
      ctx!.clearRect(0, 0, W, H);
      const margin = 200;
      for (const a of albums) {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x > W + margin) a.x = -margin;
        if (a.x < -margin) a.x = W + margin;
        if (a.y > H + margin) a.y = -margin;
        if (a.y < -margin) a.y = H + margin;
        drawAlbum(a);
      }
      rafId = requestAnimationFrame(frame);
    }

    function handleVisibility() {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else if (!stopped) { rafId = requestAnimationFrame(frame); }
    }

    let resizeTimer: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { init(); }, 150);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("resize", handleResize);

    init();
    if (reducedMotion) {
      ctx.clearRect(0, 0, W, H);
      for (const a of albums) drawAlbum(a);
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}
