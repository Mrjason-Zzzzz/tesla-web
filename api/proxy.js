// 文件路径：api/proxy.js

export default async function handler(req, res) {
  // 1. 获取 URL 参数
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Error: 请在 URL 中包含 ?url= 参数");
  }

  try {
    // 2. 伪造请求头 (模拟特斯拉车机)
    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 12; Tesla Model Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.google.com/",
    };

    // 3. 使用原生 fetch (Node.js 18+ 内置，无需 import)
    const targetResponse = await fetch(url, { headers });

    if (!targetResponse.ok) {
      return res.status(targetResponse.status).send(`源站错误: ${targetResponse.statusText}`);
    }

    let m3u8Content = await targetResponse.text();

    // 4. 路径修复 (把相对路径转为绝对路径)
    // 这一步是为了防止 m3u8 里的 .ts 切片加载失败
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    m3u8Content = m3u8Content.replace(/^(?!#)(?!http)(.+)$/gm, (match) => {
      return baseUrl + match;
    });

    // 5. 设置响应头 (允许跨域)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    
    // 6. 返回处理后的 m3u8 内容
    res.status(200).send(m3u8Content);

  } catch (error) {
    console.error(error);
    res.status(500).send("代理服务内部错误: " + error.message);
  }
}
