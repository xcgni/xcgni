/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        body: 'rgb(var(--c-body) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        bad: 'rgb(var(--c-bad) / <alpha-value>)'
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Instrument Sans Variable', 'Instrument Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '3px'   /* machined corner: present, but nothing like a friendly app's 12px */
      }
    }
  },
  plugins: []
};
