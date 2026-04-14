/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#10445C',
          DEFAULT: '#70B9DA',
          light: '#E2F5FD',
        },
        accent: {
          purple: '#4C269B',
          orange: '#E87C2A',
        },
        secondary: '#335586',
      },
    },
  },
};
