export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, url } = req.query;
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    if (action === 'login') {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing username or password' });
        }

        try {
            // 1. Fetch login page to get tokens
            const resp1 = await fetch('https://news.san-andreas.net/ucp.php?mode=login', {
                headers: { 'User-Agent': userAgent }
            });
            const html1 = await resp1.text();

            // Extract form tokens
            const form_token = html1.match(/name="form_token" value="(.*?)"/)?.[1] || '';
            const creation_time = html1.match(/name="creation_time" value="(.*?)"/)?.[1] || '';
            const sid = html1.match(/name="sid" value="(.*?)"/i)?.[1] || '';

            // Get initial cookies and extract only name=value parts
            const getCookies = (resp) => {
                const setCookies = resp.headers.getSetCookie?.() || [];
                return setCookies.map(c => c.split(';')[0]);
            };

            let cookies = getCookies(resp1);

            // 2. Perform Login
            let loginUrl = 'https://news.san-andreas.net/ucp.php?mode=login';
            if (sid) loginUrl += `&sid=${sid}`;

            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);
            params.append('sid', sid);
            params.append('login', 'Login');
            params.append('autologin', 'on');
            params.append('form_token', form_token);
            params.append('creation_time', creation_time);
            params.append('redirect', 'index.php');

            const resp2 = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://news.san-andreas.net/ucp.php?mode=login',
                    'Cookie': cookies.join('; ')
                },
                body: params.toString(),
                redirect: 'manual'
            });

            const responseHtml = await resp2.text();
            const loginCookies = getCookies(resp2);
            const combinedCookies = [...cookies, ...loginCookies];

            // Success Check
            const is_success = (
                responseHtml.includes('Logout') ||
                responseHtml.includes('ucp.php?mode=logout') ||
                responseHtml.includes('memberlist.php?mode=viewprofile') ||
                resp2.status === 302
            );

            if (is_success) {
                return res.status(200).json({
                    success: true,
                    message: 'Logged in successfully',
                    cookies: combinedCookies.join('; ')
                });
            } else {
                // Return parts of the response for debugging if it failed
                return res.status(401).json({
                    error: 'Login failed. Check credentials.',
                    status: resp2.status,
                    debug: {
                        token: form_token ? 'Found' : 'Missing',
                        sid: sid ? 'Found' : 'Missing',
                        responseSnippet: responseHtml.substring(0, 200)
                    }
                });
            }
        } catch (err) {
            console.error("Login Error:", err);
            return res.status(500).json({ error: "Server Error during login: " + err.message });
        }
    }

    if (action === 'fetch') {
        if (!url) return res.status(400).json({ error: 'Missing URL' });

        // Cookie passed in header or query
        const manual_cookie = req.headers.cookie || req.query.cookie || '';

        try {
            const resp = await fetch(decodeURIComponent(url), {
                headers: {
                    'User-Agent': userAgent,
                    'Referer': 'https://news.san-andreas.net/',
                    'Cookie': manual_cookie
                }
            });

            const html = await resp.text();
            return res.status(200).json({
                status: resp.status,
                html: html
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(404).json({ error: 'Action not found' });
}
