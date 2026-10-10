/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: {
          50: '#F7F7FE',
          100: '#EEEEFE',
          300: '#BFBFBF',
          400: '#737373',
          500: '#6F6F89',
          700: '#3E3CB9',
          900: '#000000',
        },
        ajarin: {
          50: '#EEEEFE',
          100: '#E2E1FE',
          200: '#CAC9FD',
          400: '#7C7CFF',
          500: '#5350F7',
          600: '#3E3CB9',
          700: '#1D1C56',
        },
        pelita: {
          50: '#FFF8E6',
          100: '#FDEBB8',
          400: '#F4B942',
          500: '#E5A21F',
          700: '#9A6A0B',
        },
        kertas: '#FFFFFF',
        merah: '#EB3D3D',
        hijau: '#147306',
      },
      boxShadow: {
        kartu: '0 14px 42px rgba(8, 15, 52, 0.06)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
