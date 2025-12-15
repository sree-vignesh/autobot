/**
 * scraper.js
 * -----------------
 * Safely scroll and extract LinkedIn job cards
 */

async function scrapeJobs(page) {
  // Scroll jobs until all cards are hydrated
  await page.evaluate(async () => {
    // Find the job list container
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return;

    // Determine scrollable container
    const container =
      ul.parentElement?.scrollHeight > ul.scrollHeight ? ul.parentElement : ul;

    let prevCount = 0,
      stableCounter = 0;

    while (stableCounter < 3) {
      container.scrollTop += 1000; // scroll down
      await new Promise((r) => setTimeout(r, 400)); // wait for lazy-load

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

  // Now extract jobs safely
  return await page.evaluate(() => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return { error: "Jobs UL not found" };

    const lis = [...ul.children].filter((el) => el.tagName === "LI");

    return {
      total: lis.length,
      jobs: lis.map((li) => {
        try {
          const link = li.querySelector('a[href*="/jobs/view/"]');
          const title = link?.innerText?.trim().split("\n")[0] || null;
          const url = link?.href || null;

          const companyEl =
            li.querySelector("h4 span") ||
            li.querySelector("[aria-label*='Company']");
          const company = companyEl ? companyEl.innerText.trim() : null;

          const locationEl = [...li.querySelectorAll("span")].find((span) =>
            /(Remote|On-site|Hybrid|India)/i.test(span.innerText)
          );
          const location = locationEl ? locationEl.innerText.trim() : null;

          // Collect other details (post date, promoted, etc.)
          const detailsEls = [...li.querySelectorAll("span, div")];
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
      }),
    };
  });
}

module.exports = scrapeJobs;
