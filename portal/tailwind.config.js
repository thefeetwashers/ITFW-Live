/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        niptei: { navy: "#0b1f3a", blue: "#1d4ed8", gold: "#b45309" },
      },
    },
  },
  plugins: [],
};
