// 文件路径：api/proxy.js
// v43.0 流式传输版：彻底解决视频切片加载失败/黑屏问题
import { Readable } from 'stream';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Error: 请提供 ?url= 参数");
  }

  // 获取当前域名的前缀，用于拼接
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const proxyBaseUrl = `${protocol}://${host}/api/proxy?url=`;

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 12; Tesla Model Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.google.com/",
    };

    // 发起请求
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return res.status(response.status).send(`源站错误: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");

    // === 情况 1：如果是 m3u8 索引文件 (需要修改内容) ===
    if (url.includes(".m3u8") || (contentType && contentType.includes("mpegurl"))) {
      let m3u8Text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

      // 正则替换：给所有视频链接穿上“代理马甲”
      // 解决“链接没变”的疑虑：实际上内容里的链接变了，只是地址栏看不到
      m3u8Text = m3u8Text.replace(/^(?!#)(.+)$/gm, (match) => {
        let line = match.trim();
        if (!line.startsWith('http')) {
           line = baseUrl + line; // 补全相对路径
        }
        return `${proxyBaseUrl}${encodeURIComponent(line)}`;
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(200).send(m3u8Text);
    } 
    // === 情况 2：如果是视频切片 .ts (需要流式转发) ===
    else {
      // 设置响应头，透传 Content-Type
      res.setHeader("Content-Type", contentType || "video/mp2t");
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      // 【核心修复】使用 Node.js 原生流对接
      // 这能极大降低内存占用，防止 Vercel 报错
      if (response.body) {
        // 将 Web Stream 转换为 Node Stream 并通过管道(pipe)直接发给客户端
        // 这是最快、最稳的传输方式
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    }

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).send("代理异常: " + error.message);
  }
}
