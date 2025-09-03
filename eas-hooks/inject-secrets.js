const fs = require("fs");
const path = require("path");

module.exports = async ({ platform, buildProfile }) => {
  if (platform !== "android") return;

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");

  const stringsPath = "android/app/src/main/res/values/strings.xml";
  let content = fs.readFileSync(stringsPath, "utf8");

  // Inject the API key
  content = content.replace(
    "</resources>",
    `  <string name="google_maps_api_key">${apiKey}</string>\n</resources>`
  );

  fs.writeFileSync(stringsPath, content);
};
