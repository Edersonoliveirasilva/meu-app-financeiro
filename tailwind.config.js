/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f172a',
        glass: 'rgba(255, 255, 255, 0.05)',
        neonGreen: '#34d399',
        neonRed: '#f43f5e'
      }
    },
  },
  plugins: [],
}