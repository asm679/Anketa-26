/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#12305C",
          dark: "#0B2142",
          med: "#2E4E7A",
          50: "#EEF1F6",
        },
        gold: {
          DEFAULT: "#9C7A2A",
          light: "#D4B860",
        },
        ink: "#1B1B1B",
        muted: "#5B5F66",
        faint: "#8A8E94",
        border: "#C7CCD3",
        "border-light": "#E1E4E8",
        surface: "#F6F7F9",
        "surface-alt": "#EEF1F6",
        error: "#A12C2C",
        success: "#3E7A3E",
        warning: "#9C6A1E",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,48,92,0.06), 0 1px 8px rgba(18,48,92,0.06)",
      },
    },
  },
  plugins: [],
};
