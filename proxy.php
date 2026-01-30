<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = $_GET['action'] ?? 'fetch';
$target_url = $_GET['url'] ?? '';
$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

// Persistent cookie storage
$cookie_file = __DIR__ . '/cookie.txt';

if ($action === 'login') {
    if (!$username || !$password) {
        echo json_encode(['error' => 'Missing username or password']);
        exit;
    }

    // Clear old cookies to start fresh
    if (file_exists($cookie_file))
        @unlink($cookie_file);

    // 1. Fetch login page to get tokens
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://news.san-andreas.net/ucp.php?mode=login');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

    // Use cookie file from the start
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);

    $html = curl_exec($ch);
    file_put_contents(__DIR__ . '/debug_step1.html', $html);

    // Extract form tokens
    preg_match('/name="form_token" value="(.*?)"/', $html, $token_match);
    preg_match('/name="creation_time" value="(.*?)"/', $html, $time_match);
    preg_match('/name="sid" value="(.*?)"/i', $html, $sid_match);

    $form_token = $token_match[1] ?? '';
    $creation_time = $time_match[1] ?? '';
    $sid = $sid_match[1] ?? '';

    // Wait a brief moment to avoid "too fast" submission errors
    usleep(800000);

    // 2. Perform Login
    // Include sid in URL if found
    $login_url = 'https://news.san-andreas.net/ucp.php?mode=login';
    if ($sid)
        $login_url .= '&sid=' . $sid;

    curl_setopt($ch, CURLOPT_URL, $login_url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_REFERER, 'https://news.san-andreas.net/ucp.php?mode=login');

    $post_data = [
        'username' => $username,
        'password' => $password,
        'sid' => $sid,
        'login' => 'Login',
        'autologin' => 'on',
        'form_token' => $form_token,
        'creation_time' => $creation_time,
        'redirect' => 'index.php'
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
    $response = curl_exec($ch);
    file_put_contents(__DIR__ . '/debug_step2.html', $response);

    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Success Check
    $is_success = (strpos($response, 'Logout') !== false ||
        strpos($response, 'ucp.php?mode=logout') !== false ||
        strpos($response, 'memberlist.php?mode=viewprofile') !== false ||
        $http_code == 302);

    if ($is_success) {
        // Save the cookies for future 'fetch' actions
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
        curl_close($ch);
        echo json_encode(['success' => true, 'message' => 'Logged in successfully']);
    } else {
        curl_close($ch);
        $error_msg = 'Login failed. Check credentials.';
        if (strpos($response, 'The submitted form was invalid') !== false) {
            $error_msg = 'Submit invalid (Form Security). Try again in a moment.';
        } else if (strpos($response, 'Maximum number of login attempts') !== false) {
            $error_msg = 'Too many attempts. Real login with CAPTCHA required.';
        }

        echo json_encode([
            'error' => $error_msg,
            'status' => $http_code,
            'debug' => [
                'token' => $form_token,
                'sid' => $sid,
                'len' => strlen($response)
            ]
        ]);
    }
    exit;
}

// Default action: fetch
if (!$target_url) {
    echo json_encode(['error' => 'Missing URL']);
    exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_REFERER, 'https://news.san-andreas.net/');

// Use the cookie jar
if (file_exists($cookie_file)) {
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);
}
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);

// Fallback manual cookie if provided via GET (for backward compatibility during migration)
$manual_cookie = $_GET['cookie'] ?? '';
if ($manual_cookie) {
    curl_setopt($ch, CURLOPT_COOKIE, $manual_cookie);
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo json_encode(['error' => curl_error($ch)]);
} else {
    echo json_encode([
        'status' => $http_code,
        'html' => $response
    ]);
}

curl_close($ch);
?>