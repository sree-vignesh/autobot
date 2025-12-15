const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Go to naukri login page
  await page.goto("https://linkedin.com/");

  console.log("🚀 Log in manually in the opened browser...");

  // Wait for you to log in manually
  await page.waitForTimeout(60000); // 60 seconds to log in

  // Save cookies/session storage
  const storage = await page
    .context()
    .storageState({ path: "data/linkedin-session.json" });
  console.log("✅ Session saved to linkedin-session.json");

  await browser.close();
})();
