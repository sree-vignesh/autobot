const { chromium } = require('playwright');

const zoomLink = 'https://us05web.zoom.us/j/84439024126?pwd=bkdz5OyooJBYwJaghmXcbx1xF080uK.1';
const numInstances = 5; // how many browser windows you want

(async () => {
  // Launch multiple separate browser instances
  const browsers = [];

  for (let i = 0; i < numInstances; i++) {
    const browser = await chromium.launch({ headless: false }); // visible window
    const page = await browser.newPage();
    await page.goto(zoomLink);
    console.log(`✅ Opened instance #${i + 1}`);
    browsers.push(browser); // keep reference to close later if needed
  }

  // Keep browsers open for testing
  await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds

  // Close all instances
  for (const browser of browsers) {
    await browser.close();
  }
})();
