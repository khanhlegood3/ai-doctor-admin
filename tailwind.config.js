/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'shine': 'shine 1s ease-in-out forwards',
        'bounce-x': 'bounce-x 1s infinite',
      },
      keyframes: {
        'shine': {
          '0%': { left: '-100%' },
          '100%': { left: '200%' },
        },
        'bounce-x': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(25%)' },
        },
      },
    },
  },
  plugins: [],
}