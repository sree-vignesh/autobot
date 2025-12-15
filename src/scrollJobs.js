/**
 * scraper.js
 * -----------------
 * Safely extract LinkedIn job cards after scrolling
 */

async function scrapeJobs(page) {
  // First, ensure all jobs are loaded
  await page.evaluate(async () => {
    const scrollContainer =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".jobs-search-results__list");

    if (!scrollContainer) return;

    let prevCount = 0;
    let stableCounter = 0;

    while (stableCounter < 3) {
      scrollContainer.scrollBy(0, 2000); // scroll down
      await new Promise((r) => setTimeout(r, 1000)); // wait for lazy-load

      const lis = scrollContainer.querySelectorAll("li");
      const currentCount = [...lis].filter((li) =>
        li.querySelector("a.job-card-container__link")
      ).length;

      if (currentCount === prevCount) stableCounter++;
      else {
        prevCount = currentCount;
        stableCounter = 0;
      }
    }
  });

  // Now extract jobs safely
  return await page.evaluate(() => {
    const container =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".jobs-search-results__list");
    if (!container) return { error: "Jobs container not found" };

    const lis = [...container.querySelectorAll("li")];

    const jobs = lis.map((li) => {
      try {
        const link = li.querySelector("a.job-card-container__link");
        const title = link?.getAttribute("aria-label")?.trim() || null;
        const url = link?.href || null;

        const company =
          li
            .querySelector(".artdeco-entity-lockup__subtitle span")
            ?.innerText?.trim() || null;

        const location =
          li
            .querySelector(".job-card-container__metadata-wrapper span")
            ?.innerText?.trim() || null;

        // Collect footer details
        const detailsEls = [
          ...li.querySelectorAll(
            ".job-card-list__footer-wrapper li span, .job-card-list__footer-wrapper li"
          ),
        ];
        const otherDetails = detailsEls
          .map((el) => el?.innerText?.trim())
          .filter((t) => t && t !== title && t !== company && t !== location);

        const details = [...new Set(otherDetails)].join(" | ");

        return { title, url, company, location, details };
      } catch (err) {
        return {
          title: null,
          url: null,
          company: null,
          location: null,
          details: null,
        };
      }
    });

    return { total: jobs.length, jobs };
  });
}

module.exports = scrapeJobs;
