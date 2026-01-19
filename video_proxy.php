<?php
// 解决跨域 + 适配特斯拉车机 + 防盗链
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: *");
header("Content-Type: application/x-mpegURL"); // 适配m3u8

// 禁用缓存（特斯拉车机缓存会导致播放异常）
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// 获取视频地址
$url = $_GET['url'] ?? '';
if (empty($url)) {
    http_response_code(400);
    echo "Error: 视频地址为空";
    exit;
}

// 模拟特斯拉车机请求头（关键：绕开防盗链/屏蔽）
$headers = [
    "User-Agent: Mozilla/5.0 (Linux; Android 12; Tesla Model Y Build/TP1A.220829.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.105 Mobile Safari/537.36",
    "Referer: https://www.tesla.com",
    "Accept: */*"
];

// 初始化curl（确保能抓取m3u8分片）
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, urldecode($url));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1); // 跟随302跳转（m3u8必选）
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0); // 忽略SSL错误（测试环境必选）
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

// 执行请求
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// 错误处理（确保能定位问题）
if (curl_errno($ch)) {
    http_response_code(500);
    echo "Error: " . curl_error($ch);
    curl_close($ch);
    exit;
}
curl_close($ch);

// 输出响应（关键：透传m3u8内容）
http_response_code($httpCode);
echo $response;
exit;
