/**
 * scraper.js
 * -----------------
 * Extracts job data from LinkedIn jobs page.
 */

async function scrapeJobs(page) {
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

        // Extract job title
        const title = link.innerText.trim().split("\n")[0] || null;

        // Extract company name
        const companyEl =
          li.querySelector("h4 span") ||
          li.querySelector("[aria-label*='Company']");
        const company = companyEl ? companyEl.innerText.trim() : null;

        // Extract location
        const locationEl = [...li.querySelectorAll("span")].find((span) =>
          /(Remote|On-site|Hybrid|India)/i.test(span.innerText)
        );
        const location = locationEl ? locationEl.innerText.trim() : null;

        // Extract other details (posted time, promoted, etc.)
        const detailsEls = [...li.querySelectorAll("span, div")];
        const otherDetails = detailsEls
          .map((el) => el.innerText.trim())
          .filter((t) => t && t !== title && t !== company && t !== location);
        const details = [...new Set(otherDetails)].join(" | ");

        return { title, url: link.href, company, location, details };
      }),
    };
  });

  return jobs;
}

module.exports = scrapeJobs;
