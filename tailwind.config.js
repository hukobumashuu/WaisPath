/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")], // Add this line!
  theme: {
    extend: {
      // PWD-focused design system for Philippine context
      colors: {
        accessible: {
          green: "#22C55E", // Clear sidewalk path
          yellow: "#F59E0B", // Obstacles/caution
          red: "#EF4444", // Blocked/dangerous
          blue: "#3B82F6", // Primary navigation
          gray: "#6B7280", // Neutral info
        },
        // Filipino-friendly high contrast
        pasig: {
          blue: "#1E40AF", // City colors
          green: "#059669",
        },
      },
      fontSize: {
        // Accessibility-compliant sizes
        "touch-min": "18px", // Minimum readable
        "touch-optimal": "22px", // Preferred size
        "touch-large": "26px", // Large accessibility
      },
      spacing: {
        // Touch-friendly spacing for PWD users
        "touch-min": "44px", // Minimum touch target (iOS/Android)
        "touch-safe": "48px", // Safe touch area
        "thumb-zone": "72px", // Easy thumb reach
      },
      fontFamily: {
        // System fonts optimized for readability
        accessible: ["System", "sans-serif"],
      },
    },
  },
  plugins: [],
};
