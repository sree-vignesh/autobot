const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true }); // headless: false opens a visible window
  const page = await browser.newPage();

  await page.goto("https://example.com");
  console.log("Page title:", await page.title());

  // Keep browser open for 10 seconds
  await page.waitForTimeout(10000);

  await browser.close();
})();
