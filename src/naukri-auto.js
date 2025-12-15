const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false }); // visible browser
  const context = await browser.newContext({
    storageState: "data/naukri-session.json", // load your saved session
  });

  const page = await context.newPage();
  await page.goto("https://www.naukri.com/mnjuser/homepage", {
    waitUntil: "networkidle",
  });

  console.log("✅ Opened Naukri as logged-in user");
  console.log("Page title:", await page.title());

  // Keep browser open for testing
  // await page.waitForTimeout(1500);

  await browser.close();
})();
