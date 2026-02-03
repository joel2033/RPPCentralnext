import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // PRD Color System
        rpp: {
          orange: {
            DEFAULT: "#F05A2A",
            hover: "#D94E24",
            light: "#FF6B3D",
            subtle: "rgba(240, 90, 42, 0.1)",
          },
          sidebar: {
            DEFAULT: "#2F373F",
            dark: "#3F474F",
          },
          grey: {
            darkest: "#1F2937",
            dark: "#3F474F",
            DEFAULT: "#6B7280",
            light: "#9CA3AF",
            lighter: "#E5E7EB",
            lightest: "#F3F4F6",
            pale: "#F9FAFB",
          },
        },
        semantic: {
          yellow: {
            DEFAULT: "#F59E0B",
            light: "#FEF3C7",
            dark: "#D97706",
          },
          green: {
            DEFAULT: "#10B981",
            light: "#D1FAE5",
            dark: "#047857",
          },
          blue: {
            DEFAULT: "#3B82F6",
            light: "#DBEAFE",
            dark: "#1D4ED8",
          },
          red: {
            DEFAULT: "#EF4444",
            light: "#FEE2E2",
            dark: "#DC2626",
          },
          purple: {
            DEFAULT: "#8B5CF6",
            light: "#EDE9FE",
            dark: "#6D28D9",
          },
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        shimmer: {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(200%)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
