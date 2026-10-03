/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#EEF4F1',
          100: '#D6E5DD',
          400: '#3F8367',
          600: '#2D6A4F',
          700: '#1F5C4C',
          900: '#123328',
        },
        amber: {
          50: '#FDF3E3',
          400: '#E8A33D',
          500: '#D68C34',
          600: '#B8721F',
        },
        paper: '#F6F7F3',
        ink: '#1B2521',
      },
      fontFamily: {
        display: ['"Newsreader"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
