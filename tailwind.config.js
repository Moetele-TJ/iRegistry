/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "iregistrygreen": "#1FAA63",
      },
      borderRadius: {
        'card': '12px',
      }
    },
  },
  plugins: [],
};
