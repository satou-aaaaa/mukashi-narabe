// アプリのアイコン（icon-192.png・icon-512.png・icon-512-maskable.png）を作る。maskable は絵を中心から0.75倍にして、丸く切られても欠けないようにする（安全な範囲は中心の直径80%）。生成りの地に、萌黄の軸の絵巻と、順番の札1・2・3。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [s, name, k] of [[192, "icon-192.png", 1], [512, "icon-512.png", 1], [512, "icon-512-maskable.png", 0.75]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3ead6"/><g transform="translate(50 50) scale(${k}) translate(-50 -50)">
      <rect x="14" y="20" width="72" height="60" rx="3" fill="#fffaf0" stroke="#2b2420" stroke-width="2"/>
      <rect x="10" y="16" width="80" height="8" rx="4" fill="#4d6b2a"/><rect x="10" y="76" width="80" height="8" rx="4" fill="#4d6b2a"/>
      ${[0, 1, 2].map((i) => `<circle cx="27" cy="${36 + i * 15}" r="6" fill="#a8321a"/><text x="27" y="${40 + i * 15}" font-size="10" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">${i + 1}</text><rect x="38" y="${32 + i * 15}" width="${38 - i * 8}" height="7" rx="3" fill="#5e5248"/>`).join("")}
      </g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", name), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
