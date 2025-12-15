const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
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

  // Scroll jobs until all cards are hydrated
  await page.evaluate(async () => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return;

    const container =
      ul.parentElement?.scrollHeight > ul.scrollHeight ? ul.parentElement : ul;

    let prevCount = 0,
      stableCounter = 0;

    while (stableCounter < 3) {
      container.scrollTop += 1000;
      await new Promise((r) => setTimeout(r, 400));

      const lis = [...ul.children].filter((el) => el.tagName === "LI");
      const dataCount = lis.filter((li) =>
        li.querySelector('a[href*="/jobs/view/"]')
      ).length;

      if (dataCount === prevCount) stableCounter++;
      else {
        stableCounter = 0;
        prevCount = dataCount;
      }
    }
  });

  await page.waitForTimeout(1000);

  // Extract clean job info
  const jobs = await page.evaluate(() => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return { error: "Jobs UL not found" };

    const lis = [...ul.children].filter((el) => el.tagName === "LI");

    return {
      total: lis.length,
      jobs: lis.map((li) => {
        const link = li.querySelector('a[href*="/jobs/view/"]');
        if (!link)
          return {
            title: null,
            url: null,
            company: null,
            location: null,
            details: null,
          };

        const title = link.innerText.trim().split("\n")[0] || null;

        const companyEl =
          li.querySelector("h4 span") ||
          li.querySelector("[aria-label*='Company']");
        const company = companyEl ? companyEl.innerText.trim() : null;

        // Vanilla JS way to get location (scan all spans)
        const locationEl = [...li.querySelectorAll("span")].find((span) =>
          /(Remote|On-site|Hybrid|India)/i.test(span.innerText)
        );
        const location = locationEl ? locationEl.innerText.trim() : null;

        // Collect other details (post date, promoted, etc.)
        const detailsEls = [...li.querySelectorAll("span, div")];
        const otherDetails = detailsEls
          .map((el) => el.innerText.trim())
          .filter((t) => t && t !== title && t !== company && t !== location);
        const details = [...new Set(otherDetails)].join(" | ");

        return { title, url: link.href, company, location, details };
      }),
    };
  });

  if (jobs.error) console.log("❌", jobs.error);
  else {
    console.log(`🟢 Direct job cards: ${jobs.total}`);
    jobs.jobs.forEach((job, i) => {
      console.log(
        `[${i + 1}] ${job.title || "(no title)"} | ${job.company || ""} | ${
          job.location || ""
        }`
      );
      if (job.details) console.log(`     Details: ${job.details}`);
      console.log("--------------------------------------------------");
    });
  }

  await page.waitForTimeout(1500000);
  await browser.close();
})();
