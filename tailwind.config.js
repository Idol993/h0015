/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'clinic-blue': '#1d4ed6',
        'clinic-dark': '#111111',
        'clinic-gray': '#aaaaaa',
      }
    },
  },
  plugins: [],
}
