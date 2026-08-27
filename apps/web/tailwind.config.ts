import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1f3a",
        moss: "#2563eb",
        clay: "#0f7ae5",
        paper: "#f4f7fc",
        line: "#dce6f2"
      },
      boxShadow: {
        panel: "0 16px 40px rgba(11, 31, 58, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
