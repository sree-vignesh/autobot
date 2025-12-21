/**
 * scraper.js
 * -----------------
 * Safely scroll and extract LinkedIn job cards (STRUCTURED)
 */

async function scrapeJobs(page) {
  // ---------------- SCROLL (UNCHANGED) ----------------
  await page.evaluate(async () => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return;

    const container =
      ul.parentElement?.scrollHeight > ul.scrollHeight ? ul.parentElement : ul;

    let prevCount = 0;
    let stableCounter = 0;

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

  // ---------------- EXTRACTION (STRUCTURED) ----------------
  return await page.evaluate(() => {
    const ul = document.querySelector('ul:has(a[href*="/jobs/view/"])');
    if (!ul) return { error: "Jobs UL not found" };

    const lis = [...ul.children].filter(
      (li) =>
        li.tagName === "LI" &&
        li.dataset.occludableJobId &&
        li.querySelector('a[href*="/jobs/view/"]')
    );

    return {
      total: lis.length,
      jobs: lis.map((li, index) => {
        const jobId = li.dataset.occludableJobId || null;

        const link = li.querySelector('a[href*="/jobs/view/"]');
        const url = link?.href || null;

        const title = link?.innerText?.trim().split("\n")[0] || null;

        // const company = li.querySelector("h4 span")?.innerText?.trim() || null;
        const company =
          li
            .querySelector(".artdeco-entity-lockup__subtitle span")
            ?.innerText?.trim() || null;

        const location =
          li
            .querySelector(".job-card-container__metadata-item span")
            ?.innerText?.trim() ||
          [...li.querySelectorAll("span")]
            .find((s) => /(Remote|On-site|Hybrid|India)/i.test(s.innerText))
            ?.innerText?.trim() ||
          null;

        const remote = /remote/i.test(location || "");

        const promoted = [...li.querySelectorAll("span")].some(
          (s) => s.innerText?.trim() === "Promoted"
        );

        const viewed = [...li.querySelectorAll("li")].some(
          (li2) => li2.innerText?.trim() === "Viewed"
        );

        const verified = !!li.querySelector(
          'svg[data-test-icon="verified-small"]'
        );

        const easyApply = [...li.querySelectorAll("span")].some(
          (span) => span.innerText?.trim() === "Easy Apply"
        );

        const alumInsight =
          [...li.querySelectorAll("span")]
            .find((s) => /alum works here/i.test(s.innerText))
            ?.innerText?.trim() || null;

        return {
          index: index + 1,
          jobId,
          title,
          verified,
          company,
          location,
          remote,
          promoted,
          viewed,
          easyApply,
          alumInsight,
          url,
        };
      }),
    };
  });
}

module.exports = scrapeJobs;
