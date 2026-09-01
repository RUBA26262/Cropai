/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f2f6f3',
          100: '#dce8df',
          200: '#b8d1bf',
          300: '#8fb599',
          400: '#5f8f6c',
          500: '#3f6f4c',
          600: '#2f5a3b',
          700: '#264830',
          800: '#1f3a27',
          900: '#1b2f21',
        },
        clay: {
          400: '#d98a5f',
          500: '#c96f3e',
          600: '#ad5830',
        },
        cream: 'var(--background)',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
