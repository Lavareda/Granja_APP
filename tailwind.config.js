/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        farm: {
          ink: "#17211b",
          green: "#2f6f4f",
          leaf: "#5f8d4e",
          lime: "#dbe7b6",
          straw: "#e5c46b",
          clay: "#b86b4b",
          sky: "#d9ecf2",
        },
      },
      boxShadow: {
        panel: "0 18px 50px rgba(23, 33, 27, 0.08)",
      },
    },
  },
  plugins: [],
};
