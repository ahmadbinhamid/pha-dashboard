import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "hsl(var(--bg))",
          2: "hsl(var(--bg-2))"
        },
        fg: {
          DEFAULT: "hsl(var(--fg))",
          2: "hsl(var(--fg-2))"
        },
        card: "hsl(var(--card))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          fg: "hsl(var(--accent-fg))"
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          fg: "hsl(var(--danger-fg))"
        },
        warn: {
          DEFAULT: "hsl(var(--warn))",
          fg: "hsl(var(--warn-fg))"
        },
        ok: {
          DEFAULT: "hsl(var(--ok))",
          fg: "hsl(var(--ok-fg))"
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          muted: "hsl(var(--gold-muted))"
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))"
        }
      },
      boxShadow: {
        soft: "0 1px 0 0 rgba(255,255,255,.05) inset, 0 10px 30px rgba(0,0,0,.12)",
        card: "0 1px 0 rgba(255,255,255,.06) inset, 0 1px 1px rgba(0,0,0,.10), 0 12px 28px rgba(0,0,0,.14)",
        glow: "0 0 0 1px rgba(59,130,246,0.15), 0 20px 50px -20px rgba(59,130,246,0.25)",
        "glow-gold": "0 0 0 1px rgba(200,162,74,0.2), 0 20px 40px -24px rgba(200,162,74,0.15)"
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        marquee: "marquee 45s linear infinite",
        "fade-slide": "fade-slide 0.6s ease-out forwards"
      }
    }
  },
  plugins: []
} satisfies Config;

