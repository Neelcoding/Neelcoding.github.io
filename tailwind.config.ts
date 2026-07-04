import type { Config } from "tailwindcss";

// Buzz's Scents brand palette — change these to re-theme the whole site.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111", // near-black text / header
        cream: "#FAF6EE", // main background
        "cream-dark": "#F1E9D8",
        gold: {
          DEFAULT: "#B8935A",
          light: "#D8B37E",
          dark: "#8F6C3E",
        },
        stone: {
          DEFAULT: "#6B6660", // soft gray for secondary text
          light: "#E7E2D8",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 2px 12px rgba(17, 17, 17, 0.06)",
        "card-hover": "0 8px 24px rgba(17, 17, 17, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
