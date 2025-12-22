/**
 * index.js
 * -----------------
 * Entry point for LinkedIn job scraper.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const scrollJobs = require("./scrollJobs");
const scrapeJobs = require("./scraper");

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "data/linkedin-session.json", // Use your saved LinkedIn session
  });
  const page = await context.newPage();

  const keyword = "developer intern";
  const encodedKeyword = encodeURIComponent(keyword);
  const baseUrl = `https://www.linkedin.com/jobs/search/?distance=25&f_E=1%2C2&f_TPR=r36000&geoId=106888327&keywords=${encodedKeyword}&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true&sortBy=R`;

  // Navigate to LinkedIn job search page
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  // Wait for jobs to load
  await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 20000 });
  console.log("✅ Jobs loaded");
  console.log("Page title:", await page.title());

  // Get total jobs count
  const totalJobsText = await page.$eval(
    ".jobs-search-results-list__subtitle > span:nth-child(1)",
    (el) => el.textContent.trim()
  );
  console.log("Total jobs text:", totalJobsText);

  // Extract numeric value from text (e.g., "1,234 results" -> 1234)
  const totalJobsMatch = totalJobsText.match(/[\d,]+/);
  const totalJobs = totalJobsMatch
    ? parseInt(totalJobsMatch[0].replace(/,/g, ""))
    : 0;
  console.log("Total jobs count:", totalJobs);

  // Calculate number of pages (25 jobs per page + 1 for exception)
  const jobsPerPage = 25;
  const totalPages = Math.ceil(totalJobs / jobsPerPage);
  console.log(`Total pages to scrape: ${totalPages}`);

  // Array to store all jobs
  const allJobs = [];

  // Loop through all pages
  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const startIndex = pageNum * jobsPerPage;
    const pageUrl = `${baseUrl}&start=${startIndex}`;

    console.log(
      `\n📄 Scraping page ${pageNum + 1}/${totalPages} (start=${startIndex})`
    );

    // Navigate to the page (skip first page as we're already there)
    if (pageNum > 0) {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 20000 });
    }

    // Scroll jobs until all are hydrated
    await scrollJobs(page);

    // Extract jobs
    const jobsData = await scrapeJobs(page);

    // Check for errors
    if (jobsData.error) {
      console.log("❌", jobsData.error);
      break;
    }

    // If no jobs found, we've reached the end
    if (!jobsData.jobs || jobsData.jobs.length === 0) {
      console.log("No more jobs found. Stopping pagination.");
      break;
    }

    // Add jobs to the collection
    allJobs.push(...jobsData.jobs);
    console.log(`✅ Extracted ${jobsData.jobs.length} jobs from this page`);
    console.log(`Total jobs collected so far: ${allJobs.length}`);

    // Add a delay between pages to avoid rate limiting
    await page.waitForTimeout(2000);
  }

  // Log all extracted jobs
  console.log("\n" + "=".repeat(50));
  console.log(`📊 FINAL RESULTS: ${allJobs.length} jobs extracted`);
  console.log("=".repeat(50) + "\n");

  allJobs.forEach((job, index) => {
    console.log(`[${index + 1}]`);
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

  // Create extracted directory if it doesn't exist
  const extractedDir = path.join(__dirname, "../Extracted");
  if (!fs.existsSync(extractedDir)) {
    fs.mkdirSync(extractedDir, { recursive: true });
  }

  // Generate filename with keyword and timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace(/\..+/, "");
  const sanitizedKeyword = keyword.replace(/\s+/g, "-").toLowerCase();
  const filename = `${sanitizedKeyword}-${timestamp}.json`;
  const filepath = path.join(extractedDir, filename);

  // Prepare data to save
  const dataToSave = {
    searchUrl: baseUrl,
    keyword: keyword,
    timestamp: now.toISOString(),
    totalJobsFound: totalJobs,
    totalJobsExtracted: allJobs.length,
    jobs: allJobs,
  };

  // Save to JSON file
  fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2), "utf-8");
  console.log(`\n💾 Jobs saved to: ${filepath}`);

  await browser.close();
})();
