/**
 * scraper.js
 * -----------------
 * Safely extract LinkedIn job cards
 */

async function scrapeJobs(page) {
  return await page.evaluate(() => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return { error: "Jobs UL not found" };

    const lis = [...ul.children].filter((el) => el.tagName === "LI");

    return {
      total: lis.length,
      jobs: lis.map((li) => {
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

          // Collect details safely
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
      }),
    };
  });
}

module.exports = scrapeJobs;
