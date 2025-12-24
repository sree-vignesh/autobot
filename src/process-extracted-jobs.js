const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATA_DIR = path.join(__dirname, "../data");
const EXTRACTED_DIR = path.join(__dirname, "../Extracted");
const SESSION_FILE = path.join(DATA_DIR, "linkedin-session.json");

// Helper to prompt user
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans);
        })
    );
};

// Helper to delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to list files
const listFiles = () => {
    if (!fs.existsSync(EXTRACTED_DIR)) {
        console.log("❌ Extracted directory not found!");
        process.exit(1);
    }
    return fs
        .readdirSync(EXTRACTED_DIR)
        .filter((file) => file.endsWith(".json") && !file.includes("-detailed"))
        .sort();
};

const processJob = async (page, job) => {
    try {
        // Random delay before starting to stagger requests
        const startDelay = Math.floor(Math.random() * 2000);
        await delay(startDelay);

        await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });

        // Random delay on page to mimic human behavior
        const pageDelay = Math.floor(Math.random() * (6000 - 3000 + 1) + 3000);
        await delay(pageDelay);

        // Expand description if "See more" exists
        try {
            const seeMoreBtn = await page.$('.jobs-description__footer-button');
            if (seeMoreBtn) await seeMoreBtn.click();
        } catch (e) {
            // Ignore if button not found
        }

        // Scrape Details
        const details = await page.evaluate(() => {
            // Try multiple selectors for description
            const descriptionEl = document.querySelector('#job-details') ||
                document.querySelector('.jobs-description__content') ||
                document.querySelector('.jobs-description');

            const descriptionHtml = descriptionEl ? descriptionEl.innerHTML : "";
            const descriptionText = descriptionEl ? descriptionEl.innerText : "";

            // Extract Hirer Info
            const hirerEl = document.querySelector('.hirer-card__hirer-information');
            const hirerName = hirerEl ? hirerEl.querySelector('strong')?.innerText : null;
            const hirerProfileLink = hirerEl ? hirerEl.querySelector('a')?.href : null;

            return {
                descriptionHtml,
                descriptionText,
                hirerName,
                hirerProfileLink
            };
        });

        return {
            ...job,
            ...details,
            processedAt: new Date().toISOString(),
            success: true
        };

    } catch (err) {
        console.log(`❌ Error processing job ${job.jobId}: ${err.message}`);
        return { ...job, error: err.message, success: false };
    }
};

(async () => {
    console.log("\n🔍 Job Processor - Extract Details & Emails (Parallel Mode)\n");

    // Parse CLI Arguments
    const args = process.argv.slice(2);
    let targetFile = args[0]; // First regular argument
    const workerFlag = args.find(arg => arg.startsWith('--workers=') || arg.startsWith('-w='));
    let concurrencyArg = workerFlag ? parseInt(workerFlag.split('=')[1]) : null;

    // 1. Select File
    let selectedFile;
    const files = listFiles();
    if (files.length === 0) {
        console.log("❌ No JSON files found in Extracted/ directory.");
        process.exit(0);
    }

    if (targetFile) {
        // Check if user provided full path or just filename
        if (!targetFile.endsWith(".json")) targetFile += ".json";

        // Find matching file
        selectedFile = files.find(f => f === targetFile || f.includes(targetFile));

        if (!selectedFile) {
            console.log(`❌ File '${targetFile}' not found in Extracted/`);
            console.log("Available files:", files.join(", "));
            process.exit(1);
        }
    } else {
        // Interactive Mode
        console.log("Available files:");
        files.forEach((file, index) => {
            console.log(`[${index + 1}] ${file}`);
        });

        const choice = await askQuestion(
            "\nEnter the number of the file to process: "
        );
        const fileIndex = parseInt(choice) - 1;

        if (isNaN(fileIndex) || fileIndex < 0 || fileIndex >= files.length) {
            console.log("❌ Invalid selection.");
            process.exit(1);
        }
        selectedFile = files[fileIndex];
    }

    // 2. Select Concurrency
    let CONCURRENCY = 3;
    if (concurrencyArg) {
        CONCURRENCY = concurrencyArg;
    } else if (!targetFile) {
        // Only prompt if we are in interactive mode (no file arg provided)
        // or if the user provided a file but NOT a worker count, we could stick to default, 
        // but to be consistent with "interactive vs cli", let's assume CLI usage implies defaults if unspecified.
        // However, the user asked to "default 3 if not there".

        // If running interactively (no file arg), prompt.
        const concurrencyInput = await askQuestion(
            "Enter concurrency limit (default 3): "
        );
        CONCURRENCY = parseInt(concurrencyInput) || 3;
    }

    console.log(`\n📂 Processing: ${selectedFile}`);
    console.log(`🚀 Parallel Concurrency: ${CONCURRENCY} workers`);

    // Setup Output
    const inputFilePath = path.join(EXTRACTED_DIR, selectedFile);
    const filenameNoExt = path.parse(selectedFile).name;
    const detailedBaseDir = path.join(EXTRACTED_DIR, "detailed");
    const outputDir = path.join(detailedBaseDir, filenameNoExt);

    if (!fs.existsSync(detailedBaseDir)) fs.mkdirSync(detailedBaseDir);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFileAll = path.join(outputDir, "all.json");
    const outputFileEmails = path.join(outputDir, "with_emails.json");

    // Load Data
    const rawData = fs.readFileSync(inputFilePath, "utf-8");
    const data = JSON.parse(rawData);
    const jobs = data.jobs || [];

    console.log(`📊 Found ${jobs.length} jobs to process.`);

    // Launch Browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        storageState: SESSION_FILE,
    });

    const detailedJobs = [];
    const jobsWithEmails = [];
    let processedCount = 0;

    // Worker Function
    const worker = async (id, jobQueue) => {
        const page = await context.newPage();
        try {
            while (jobQueue.length > 0) {
                const job = jobQueue.shift();
                processedCount++;
                console.log(`[Worker ${id}] Processing ${processedCount}/${jobs.length}: ${job.title.substring(0, 30)}...`);

                const result = await processJob(page, job);

                if (result.success) {
                    detailedJobs.push(result);

                    // Check for Email
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                    if (emailRegex.test(result.descriptionText)) {
                        console.log(`📧 [Worker ${id}] Email found in: ${result.title}`);
                        jobsWithEmails.push(result);
                    }
                }
            }
        } finally {
            await page.close();
        }
    };

    // Start Workers
    const jobQueue = [...jobs];
    const workers = [];

    const startTime = Date.now();

    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(worker(i + 1, jobQueue));
    }

    await Promise.all(workers);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Save Results
    fs.writeFileSync(outputFileAll, JSON.stringify(detailedJobs, null, 2));
    fs.writeFileSync(outputFileEmails, JSON.stringify(jobsWithEmails, null, 2));

    console.log("\n✅ Processing Complete!");
    console.log(`⏱️  Time taken: ${duration}s`);
    console.log(`📁 All Jobs: ${outputFileAll}`);
    console.log(`📧 With Emails: ${outputFileEmails}`);

    await browser.close();
})();
