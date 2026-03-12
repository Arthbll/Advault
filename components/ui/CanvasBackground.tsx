"use client";

import { useEffect, useRef } from "react";

interface Props {
  opacity?: number;
  color?: string;
}

export default function CanvasBackground({ opacity = 0.3, color = "0,255,135" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const BAR_W  = 3;
    const GAP    = 9;
    const STRIDE = BAR_W + GAP;

    interface Bar {
      x:      number;
      base:   number;  // base height ratio
      amp:    number;  // oscillation amplitude
      speed:  number;
      phase:  number;
      bright: number;  // base brightness multiplier
    }

    const bars: Bar[] = [];
    const COUNT = Math.ceil(canvas.width / STRIDE) + 4;
    for (let i = 0; i < COUNT; i++) {
      bars.push({
        x:      i * STRIDE + BAR_W / 2,
        base:   Math.random() * 0.25 + 0.04,
        amp:    Math.random() * 0.18 + 0.02,
        speed:  Math.random() * 0.4  + 0.1,
        phase:  Math.random() * Math.PI * 2,
        bright: Math.random() * 0.5  + 0.5,
      });
    }

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.012;

      for (const bar of bars) {
        const hRatio = bar.base + Math.abs(Math.sin(t * bar.speed + bar.phase)) * bar.amp;
        const h      = hRatio * canvas.height;
        const alpha  = (bar.bright * (0.5 + 0.5 * Math.sin(t * bar.speed * 0.7 + bar.phase)));

        const grad = ctx.createLinearGradient(0, canvas.height - h, 0, canvas.height);
        grad.addColorStop(0,    `rgba(${color},${(alpha * 0.9).toFixed(3)})`);
        grad.addColorStop(0.5,  `rgba(${color},${(alpha * 0.4).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${color},0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(bar.x - BAR_W / 2, canvas.height - h, BAR_W, h);

        // bright tip
        ctx.fillStyle = `rgba(${color},${Math.min(alpha * 1.5, 0.95).toFixed(3)})`;
        ctx.fillRect(bar.x - 1, canvas.height - h, 2, 3);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity,
        pointerEvents: "none",
        display: "block",
      }}
    />
  );
}
