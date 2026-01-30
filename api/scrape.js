const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const chromiumMin = require('@sparticuz/chromium-min');

chromium.use(stealth);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, username, password, url } = req.body;

    let browser;
    try {
        const executablePath = await chromiumMin.executablePath();
        browser = await chromium.launch({
            args: [...chromiumMin.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromiumMin.defaultViewport,
            executablePath: executablePath,
            headless: chromiumMin.headless,
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        if (action === 'login') {
            await page.goto('https://news.san-andreas.net/ucp.php?mode=login', { waitUntil: 'networkidle' });
            await page.fill('input[name="username"]', username);
            await page.fill('input[name="password"]', password);
            await page.click('input[name="login"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });

            const state = await context.storageState();
            // In a real Vercel app, you might want to save this to a database
            // For now, we return it to the client
            await browser.close();
            return res.status(200).json({ success: true, state });
        } else if (action === 'fetch') {
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
            const html = await page.content();
            await browser.close();
            return res.status(200).json({ html });
        }

        await browser.close();
        res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
}
