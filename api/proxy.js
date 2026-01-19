// 文件路径：api/proxy.js
// v44.0 Edge Runtime 极速版
// 开启 Vercel 边缘计算模式，专门解决视频流传输卡顿/黑屏问题

export const config = {
  runtime: 'edge', // ⬅️ 核心：切换到 Edge 模式
};

export default async function handler(request) {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response("Error: 请提供 ?url= 参数", { status: 400 });
  }

  // 1. 定义请求头 (模拟特斯拉车机)
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12; Tesla Model Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Mobile Safari/537.36",
    "Referer": "https://www.google.com/",
  };

  try {
    // 2. 请求源站
    const response = await fetch(targetUrl, { headers });

    // 3. 准备响应头 (允许跨域)
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');

    // 如果源站返回错误
    if (!response.ok) {
      return new Response(`源站错误: ${response.status} ${response.statusText}`, { status: response.status });
    }

    const contentType = newHeaders.get('content-type');

    // === 情况 A：如果是 m3u8 索引文件 (需要修改内容) ===
    if (targetUrl.includes('.m3u8') || (contentType && contentType.includes('mpegurl'))) {
      const text = await response.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const proxyBaseUrl = `${urlObj.origin}${urlObj.pathname}?url=`;

      // 正则替换：给视频链接穿上代理马甲
      const modifiedText = text.replace(/^(?!#)(.+)$/gm, (match) => {
        let line = match.trim();
        // 补全相对路径
        if (!line.startsWith('http')) {
          line = baseUrl + line;
        }
        // 再次包裹进我们的代理
        return `${proxyBaseUrl}${encodeURIComponent(line)}`;
      });

      newHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
      return new Response(modifiedText, {
        headers: newHeaders,
        status: 200
      });
    }

    // === 情况 B：如果是视频切片 .ts (直接透传流) ===
    // Edge 模式下，直接返回 response.body 就是最高效的流式传输
    // 不需要任何 pipe 或 buffer 操作，原生支持
    else {
      // 确保 Content-Type 正确
      if (!contentType) newHeaders.set('Content-Type', 'video/mp2t');
      
      return new Response(response.body, {
        headers: newHeaders,
        status: 200
      });
    }

  } catch (e) {
    return new Response("代理异常: " + e.message, { status: 500 });
  }
}
