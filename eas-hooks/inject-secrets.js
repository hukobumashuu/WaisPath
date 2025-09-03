const fs = require("fs");

module.exports = async ({ platform, buildProfile }) => {
  if (platform !== "android") return;

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");

  const stringsPath = "android/app/src/main/res/values/strings.xml";
  let content = fs.readFileSync(stringsPath, "utf8");

  content = content.replace("PLACEHOLDER_REPLACED_BY_EAS", apiKey);
  fs.writeFileSync(stringsPath, content);

  console.log("API key injected successfully");
};
