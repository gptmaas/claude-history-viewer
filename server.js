const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 8800

// 创建Next.js应用
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// CORS中间件
const corsMiddleware = (req, res) => {
  const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*']
  const origin = req.headers.origin

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return true
  }

  return false
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // 应用CORS中间件
      if (corsMiddleware(req, res)) return

      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl

      // 只处理API路由
      if (pathname.startsWith('/api/')) {
        await handle(req, res, parsedUrl)
      } else {
        // 非API路由返回404
        res.statusCode = 404
        res.end('Not Found')
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Backend API server ready on http://${hostname}:${port}`)
    console.log(`> CORS allowed origins: ${process.env.CORS_ORIGIN || '*'}`)
  })
})