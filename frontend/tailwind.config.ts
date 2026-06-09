import type { Config } from 'tailwindcss';
export default { darkMode: 'class', content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { accent: '#0B3A75' } } }, plugins: [] } satisfies Config;
