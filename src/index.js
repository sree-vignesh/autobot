/**
 * index.js
 * -----------------
 * Entry point for LinkedIn job scraper.
 */

const { chromium } = require("playwright");
const scrollJobs = require("./scrollJobs");
const scrapeJobs = require("./scraper");

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "data/linkedin-session.json", // Use your saved LinkedIn session
  });
  const page = await context.newPage();

  // Navigate to LinkedIn job search page
  await page.goto(
    "https://www.linkedin.com/jobs/search/?currentJobId=4343791315&distance=25&f_E=1%2C2&f_TPR=r36000&geoId=106888327&keywords=developer%20intern&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true&sortBy=R",
    { waitUntil: "domcontentloaded" }
  );

  // Wait for jobs to load
  await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 20000 });
  console.log("✅ Jobs loaded");
  console.log("Page title:", await page.title());

  // Scroll jobs until all are hydrated
  await scrollJobs(page);

  // Extract jobs
  const jobs = await scrapeJobs(page);

  // Log extracted jobs
  if (jobs.error) {
    console.log("❌", jobs.error);
  } else {
    console.log(`🟢 Direct job cards: ${jobs.total}`);
    jobs.jobs.forEach((job) => {
      console.log(`[${job.index}]`);
      console.log(`jobId        : ${job.jobId}`);
      console.log(`title        : ${job.title}`);
      console.log(`verified     : ${job.verified}`);
      console.log(`company      : ${job.company}`);
      console.log(`location     : ${job.location}`);
      console.log(`remote       : ${job.remote}`);
      console.log(`promoted     : ${job.promoted}`);
      console.log(`viewed       : ${job.viewed}`);
      console.log(`easyApply    : ${job.easyApply}`);
      console.log(`alumInsight  : ${job.alumInsight}`);
      console.log(`url          : ${job.url}`);
      console.log("--------------------------------------------------");
    });
  }

  // Keep browser open for inspection (optional)
  await page.waitForTimeout(1500000);
  await browser.close();
})();
