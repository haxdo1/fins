<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$action = $_GET['action'] ?? 'fetch';
$target_url = $_GET['url'] ?? '';
$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

if ($action === 'login') {
    if (!$username || !$password) {
        echo json_encode(['error' => 'Missing username or password']);
        exit;
    }

    // Call Node.js scraper for login
    $cmd = "node scraper.js --login " . escapeshellarg($username) . " " . escapeshellarg($password) . " 2>&1";
    $output = shell_exec($cmd);

    $result = json_decode($output, true);
    if ($result === null) {
        echo json_encode([
            'error' => 'Failed to parse scraper output. Check if Node.js is installed and working.',
            'debug' => $output
        ]);
    } else if (isset($result['error'])) {
        echo json_encode(['error' => $result['error']]);
    } else {
        echo json_encode(['success' => true, 'message' => 'Logged in successfully via Playwright']);
    }
    exit;
}

// Default action: fetch
if (!$target_url) {
    echo json_encode(['error' => 'Missing URL']);
    exit;
}

// Call Node.js scraper for fetching
$cmd = "node scraper.js --url " . escapeshellarg($target_url) . " 2>&1";
$output = shell_exec($cmd);

$result = json_decode($output, true);

if ($result === null) {
    echo json_encode([
        'error' => 'Failed to parse scraper output.',
        'debug' => $output
    ]);
} else {
    echo json_encode($result);
}
?>
?>