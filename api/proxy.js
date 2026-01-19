// 文件路径：api/proxy.js
// 这是一个运行在 Vercel 云端的 Node.js 函数
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Error: 请提供 ?url= 参数");
  }

  try {
    // 1. 伪造特斯车机 + Google 来源的请求头
    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 12; Tesla Model Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.google.com/", 
      "Origin": "https://www.google.com"
    };

    // 2. 替你去取 m3u8 文件
    const targetResponse = await fetch(url, { headers });
    
    if (!targetResponse.ok) {
      return res.status(targetResponse.status).send(`源站错误: ${targetResponse.statusText}`);
    }

    let m3u8Content = await targetResponse.text();

    // 3. 【关键一步】处理相对路径
    // 如果 m3u8 里是 "segment01.ts" 这种相对路径，播放器会找不到。
    // 我们要把它替换成绝对路径 "https://源站.com/.../segment01.ts"
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    
    // 正则替换：把所有不以 # 开头且不以 http 开头的行，加上 baseUrl
    m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+)$/gm, (match) => {
      return baseUrl + match;
    });

    // 4. 发回给浏览器，并允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.status(200).send(m3u8Content);

  } catch (error) {
    res.status(500).send("代理失败: " + error.message);
  }
}