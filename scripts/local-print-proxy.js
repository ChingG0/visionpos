// local-print-proxy.js
//
// 用途：讓 iPad（或任何平板）改用 http:// 網址打開 VisionPOS，藉此繞開 Safari
// 「HTTPS 頁面不准呼叫 HTTP 出單機」的封鎖（這個封鎖沒有使用者端開關可以關）。
//
// 原理：這台程式在這台電腦上開一個本地 http 伺服器，收到請求後直接轉發到
// https://visionpos.netlify.app 拿回內容再回傳給 iPad——iPad 看到的網址、
// 拿到的網頁本身是 http，呼叫出單機（也是 http）就不會有「混合內容」問題。
// App 內部呼叫 Supabase（資料庫/即時同步）一律走 https，不受影響，這個代理
// 完全不需要處理那一段。
//
// 使用方式：
//   1. 在這台電腦（跟出單機、iPad 同一個網路的那台）開終端機 / 命令提示字元
//   2. cd 到這個檔案所在的資料夾
//   3. 執行：node local-print-proxy.js
//   4. 看到「本地代理已啟動」訊息後，保持這個視窗開著、不要關掉
//   5. 到 iPad 的 Safari，網址列輸入 http://（這台電腦的區網IP）:8080
//      → 如何查這台電腦的區網 IP：
//        Mac：系統設定 → Wi-Fi → 詳細資訊，或終端機打 ipconfig getifaddr en0
//        Windows：命令提示字元打 ipconfig，找「IPv4 位址」那一行
//   6. 建議把這個網址加到主畫面（分享 → 加入主畫面），以後 iPad 就固定用這個
//      入口，不要再用 https://visionpos.netlify.app
//
// 注意事項：
//   - 這台電腦要保持開機、這個程式要保持在執行，iPad 才連得到；電腦重開機
//     或關掉終端機視窗後要記得重新執行一次
//   - 這只是應急做法，之後若要正式解決（多裝置常態使用），建議改走出單機
//     內建的 CloudPRNT，那個需要另外開發一個對應的伺服器端點，之後再排時間做

const http = require('http')
const https = require('https')

const TARGET_HOST = 'visionpos.netlify.app'
const LISTEN_PORT = 8080

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: TARGET_HOST },
  }

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', (err) => {
    console.error('[proxy] 轉發失敗：', err.message)
    res.writeHead(502)
    res.end('Proxy error: ' + err.message)
  })

  req.pipe(proxyReq, { end: true })
})

server.listen(LISTEN_PORT, () => {
  console.log(`✅ 本地代理已啟動，監聽 port ${LISTEN_PORT}`)
  console.log('   iPad 用 Safari 打開：http://(這台電腦的區網IP):' + LISTEN_PORT)
  console.log('   這個視窗請保持開著，關掉代理就會停止')
})
