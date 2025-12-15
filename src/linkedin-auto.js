const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "data/linkedin-session.json",
  });

  const page = await context.newPage();

  await page.goto(
    "https://www.linkedin.com/jobs/search/?currentJobId=4343791315&distance=25&f_E=1%2C2&f_TPR=r36000&geoId=106888327&keywords=developer%20intern&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true&sortBy=R",
    { waitUntil: "domcontentloaded" }
  );

  await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 20000 });

  console.log("✅ Jobs loaded");
  console.log("Page title:", await page.title());

  // Scroll jobs list
  await page.evaluate(async () => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return;
    const container =
      ul.parentElement?.scrollHeight > ul.scrollHeight ? ul.parentElement : ul;

    for (let i = 0; i < 15; i++) {
      container.scrollTop += 700;
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  await page.waitForTimeout(1500);

  // Extract jobs with clean titles + details
  const jobs = await page.evaluate(() => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return { error: "Jobs UL not found" };

    const lis = [...ul.children].filter((el) => el.tagName === "LI");

    return {
      total: lis.length,
      jobs: lis.map((li) => {
        const link = li.querySelector('a[href*="/jobs/view/"]');
        if (!link) return { title: null, url: null, details: null };

        // Clean title (first non-empty line)
        const title = (
          link.innerText ||
          link.getAttribute("aria-label") ||
          link.getAttribute("title") ||
          ""
        )
          .split("\n")
          .map((t) => t.trim())
          .find(Boolean);

        // Extract job details below title
        const details = [...li.querySelectorAll("span, div")]
          .map((el) => el.innerText.trim())
          .filter((text) => text && text !== title); // remove title duplication

        return {
          title,
          url: link.href,
          details: details.join(" | "), // combine details as one string
        };
      }),
    };
  });

  if (jobs.error) {
    console.log("❌", jobs.error);
  } else {
    console.log(`🟢 Direct job cards: ${jobs.total}`);
    jobs.jobs.forEach((job, i) => {
      console.log(`[${i + 1}] ${job.title || "(no title)"}`);
      if (job.details) {
        console.log(`     Details: ${job.details}`);
      }
      console.log("--------------------------------------------------");
    });
  }

  await page.waitForTimeout(1500000);
  await browser.close();
})();
