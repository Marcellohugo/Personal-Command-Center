import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        moss: "#3f5b47",
        clay: "#b05f3c",
        paper: "#f8f4ec",
        line: "#ded7c9"
      },
      boxShadow: {
        panel: "0 16px 40px rgba(23, 32, 27, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
