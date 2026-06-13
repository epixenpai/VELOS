/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        velos: {
          dark: '#0F0F0F',
          primary: '#2D6FFF',
          secondary: '#F5C518'
        }
      }
    },
  },
  plugins: [],
}