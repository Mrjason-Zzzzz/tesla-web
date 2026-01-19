// 文件路径：api/proxy.js
// v42.0 全流量代理版：解决 TS 切片被拦截导致的黑屏

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Error: 请在 URL 中包含 ?url= 参数");
  }

  // 1. 获取当前 Vercel 服务的完整前缀 (例如 https://www.lgcxs.cn/api/proxy?url=)
  // 这样我们才能把 m3u8 里的 ts 链接也指向我们自己
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const proxyBaseUrl = `${protocol}://${host}/api/proxy?url=`;

  try {
    // 2. 伪造请求头
    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 12; Tesla Model Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.google.com/",
    };

    // 3. 请求源文件
    // 这里的 fetch 是 Node 18 原生自带的，不需要 import
    const targetResponse = await fetch(url, { headers });
    
    // 如果源站直接报错（比如 403/404），直接透传错误
    if (!targetResponse.ok) {
      return res.status(targetResponse.status).send(`源站错误: ${targetResponse.statusText}`);
    }

    // 4. 判断文件类型
    const contentType = targetResponse.headers.get("content-type");
    
    // 如果请求的是 m3u8 索引文件，我们需要魔改内容
    if (url.includes(".m3u8") || (contentType && contentType.includes("mpegurl"))) {
      let m3u8Content = await targetResponse.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

      // --- 核心黑科技：重写 m3u8 内容 ---
      // 正则匹配所有非注释行 (即视频切片地址)
      m3u8Content = m3u8Content.replace(/^(?!#)(.+)$/gm, (match) => {
        // 去掉可能存在的空白字符
        let originalSegmentUrl = match.trim();
        
        // 4.1 如果是相对路径 (例如 segment01.ts)，补全为绝对路径
        if (!originalSegmentUrl.startsWith('http')) {
          originalSegmentUrl = baseUrl + originalSegmentUrl;
        }

        // 4.2 【关键】把绝对路径再次包裹进我们的代理
        // 原来: https://source.com/seg.ts
        // 现在: https://www.lgcxs.cn/api/proxy?url=https://source.com/seg.ts
        // 这里的 encodeURIComponent 很重要！
        return `${proxyBaseUrl}${encodeURIComponent(originalSegmentUrl)}`;
      });

      // 5. 返回修改后的 m3u8
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.status(200).send(m3u8Content);
    } 
    // 如果请求的是 .ts 视频片段 (或者是其他非 m3u8 资源)
    else {
      // 6. 直接管道转发 (Pipe) 数据流
      // 这样不用把文件全下载到内存，而是边下边发，速度快且不占内存
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType || "video/mp2t");
      
      // Node.js 原生流转发
      const reader = targetResponse.body.getReader();
      const stream = new ReadableStream({
        start(controller) {
          return pump();
          function pump() {
            return reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              return pump();
            });
          }
        }
      });
      
      // 将 Web Stream 转为 Node Stream 发送
      // 注意：Vercel Edge Functions 支持直接返回 Response，但在 Serverless 中我们需要用 send
      // 这里为了兼容性，简单处理：直接把 ArrayBuffer 发回去
      // (对于大文件流式转发，Vercel Serverless 可能会有 10秒 限制，但 m3u8 切片通常很小，够用了)
      const buffer = await targetResponse.arrayBuffer();
      res.status(200).send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error(error);
    res.status(500).send("代理异常: " + error.message);
  }
}
