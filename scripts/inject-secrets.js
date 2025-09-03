const fs = require("fs");
const path = require("path");

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const apiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "AIzaSyAPPOhzDuWNV4PqiYdN5HrVE6loJojmyME";

if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, "utf8");

  // Replace hardcoded API key with string reference
  content = content.replace(
    /android:value="AIza[^"]*"/,
    'android:value="@string/google_maps_api_key"'
  );

  fs.writeFileSync(manifestPath, content);
  console.log("✅ API key replaced with string reference");
} else {
  console.log("❌ AndroidManifest.xml not found");
}
