const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXTRACTED_DIR = path.join(__dirname, "../Extracted");

// Helper to get the latest JSON file (excluding processed ones)
const getLatestFile = () => {
    if (!fs.existsSync(EXTRACTED_DIR)) return null;

    const files = fs.readdirSync(EXTRACTED_DIR)
        .filter(f => f.endsWith(".json") && !f.includes("-detailed") && f !== "test-job-list.json")
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(EXTRACTED_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Descending order (newest first)

    return files.length > 0 ? files[0].name : null;
};

// Main Pipeline
(async () => {
    console.log("🚀 Starting Full Automation Pipeline...");
    const args = process.argv.slice(2);
    const workerFlag = args.find(arg => arg.startsWith('--workers=') || arg.startsWith('-w='));
    const workers = workerFlag ? workerFlag.split('=')[1] : "3"; // Default 3

    try {
        // 1. Run Scraper
        console.log("\n📡 Step 1: Scraping Jobs (npm run start)...");
        // Inherit stdio to see output in real-time
        execSync("npm run start", { stdio: "inherit" });
        console.log("✅ Scraping completed.");

        // 2. Find Latest File
        const latestFile = getLatestFile();
        if (!latestFile) {
            console.error("❌ No extracted files found! Did the scraper fail?");
            process.exit(1);
        }
        console.log(`\n📂 Found latest file: ${latestFile}`);

        // 3. Run Processor
        console.log(`\n⚙️  Step 2: Processing Jobs (Workers: ${workers})...`);
        const processCommand = `node src/process-extracted-jobs.js "${latestFile}" --workers=${workers}`;
        execSync(processCommand, { stdio: "inherit" });

        console.log("\n🎉 Pipeline Finished Successfully!");

    } catch (error) {
        console.error("\n❌ Pipeline Failed:", error.message);
        process.exit(1);
    }
})();
