// metro.config.js
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// ensure cjs is understood (Firebase uses some .cjs files)
const sourceExts = config.resolver?.sourceExts
  ? config.resolver.sourceExts.slice()
  : [];
if (!sourceExts.includes("cjs")) sourceExts.push("cjs");

// Add small node polyfills that Firebase expects
const extraNodeModules = {
  ...(config.resolver?.extraNodeModules || {}),
  // point these names to packages we will install
  stream: require.resolve("stream-browserify"),
  "stream/web": require.resolve("stream-browserify"),
  events: require.resolve("events"),
};

const merged = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts,
    extraNodeModules,
  },
};

module.exports = withNativeWind(merged, {
  input: "./global.css",
});
