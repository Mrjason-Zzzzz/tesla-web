// 文件路径：api/search.js
// 这是一个专门用来转发搜索请求的后端函数

export default async function handler(req, res) {
  const { wd } = req.query;
  
  if (!wd) {
    return res.status(400).json({ error: "缺少关键词" });
  }

  // 资源站的 API 地址
  const targetUrl = `https://hhzyapi.com/api.php/provide/vod/?ac=detail&wd=${encodeURIComponent(wd)}`;

  try {
    // 1. Vercel 后端去请求资源站 (服务器之间没有跨域限制)
    const response = await fetch(targetUrl);
    
    // 2. 拿到 JSON 数据
    const data = await response.json();

    // 3. 设置允许跨域的头，并把数据返回给你的前端
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: "搜索代理失败: " + error.message });
  }
}
