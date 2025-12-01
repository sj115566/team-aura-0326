/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // 保留原本的 Indigo 主題色，也可以在這裡全站替換
          primary: {
            50: '#eef2ff',
            100: '#e0e7ff',
            200: '#c7d2fe',
            300: '#a5b4fc',
            400: '#818cf8',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#312e81',
          }
        },
        fontFamily: {
          // 設定全站字體
          sans: ['"Noto Sans TC"', 'sans-serif'],
        }
      },
    },
    plugins: [],
  }