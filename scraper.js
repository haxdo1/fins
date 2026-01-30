const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

const COOKIE_FILE = path.join(__dirname, 'cookie.json');

async function getBrowser() {
    let executablePath = '';

    // Check if running on Vercel (Linux) or locally
    try {
        const chromium = require('@sparticuz/chromium-min');
        executablePath = await chromium.executablePath();
    } catch (e) {
        // Fallback for local development
        if (process.platform === 'win32') {
            const commonPaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
            ];
            for (const p of commonPaths) {
                if (fs.existsSync(p)) {
                    executablePath = p;
                    break;
                }
            }
        } else {
            const { execSync } = require('child_process');
            try {
                executablePath = execSync('which google-chrome').toString().trim();
            } catch (err) { }
        }
    }

    return await chromium.launch({
        headless: true,
        executablePath: executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

async function login(username, password) {
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log('Navigating to login page...');
    await page.goto('https://news.san-andreas.net/ucp.php?mode=login', { waitUntil: 'networkidle' });

    // Handle potential Cloudflare wait
    await page.waitForTimeout(2000);

    console.log('Filling login form...');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('input[name="login"]');

    await page.waitForNavigation({ waitUntil: 'networkidle' });

    const state = await context.storageState();
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(state));

    console.log('Login successful, session saved.');
    await browser.close();
    return { success: true };
}

async function fetchUrl(url) {
    const browser = await getBrowser();
    const context = await browser.newContext({
        storageState: fs.existsSync(COOKIE_FILE) ? JSON.parse(fs.readFileSync(COOKIE_FILE)) : undefined,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log(`Fetching URL: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Give it a bit of time for dynamic content or CF challenges
    await page.waitForTimeout(3000);

    const html = await page.content();
    const status = await page.evaluate(() => document.status || 200);

    await browser.close();
    return { status, html };
}

// CLI Handling
const args = process.argv.slice(2);
const action = args[0];

if (action === '--login') {
    const user = args[1];
    const pass = args[2];
    login(user, pass).then(res => console.log(JSON.stringify(res))).catch(err => console.error(JSON.stringify({ error: err.message })));
} else if (action === '--url') {
    const url = args[1];
    fetchUrl(url).then(res => console.log(JSON.stringify(res))).catch(err => console.error(JSON.stringify({ error: err.message })));
} else {
    // Default or manual test
    console.log('Usage: node scraper.js --login [user] [pass] OR node scraper.js --url [url]');
}
