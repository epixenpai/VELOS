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
          dark: '#0a0a0a',
          darker: '#050505',
          panel: '#111111',
          border: '#1f1f1f',
          primary: '#2D6FFF',
          secondary: '#F5C518',
          textMuted: '#888888',
        }
      }
    },
  },
  },
  plugins: [],
}