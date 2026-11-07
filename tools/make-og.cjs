// SNS に貼ったときの絵 og.png（1200×630）を作る。今日の問題（答え）は入れない。見本は「桃太郎」のはじめの3場面だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const row = (n, t, dash) => `<div style="display:flex;gap:16px;align-items:center;font-size:30px;background:${dash ? "transparent" : "#fff"};border:${dash ? "4px dashed #8a7a6a" : "2px solid #2b242026"};border-radius:14px;padding:12px 18px;color:${dash ? "#5e5248" : "#2b2420"}"><span style="flex:0 0 46px;height:46px;border-radius:50%;background:${dash ? "transparent" : "#4d6b2a"};border:${dash ? "2px dashed #5e5248" : "none"};color:${dash ? "#5e5248" : "#fff"};display:grid;place-items:center;font-size:24px;font-weight:800">${n}</span>${t}</div>`;
  await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:#f3ead6;font-family:'Noto Serif CJK JP','Noto Sans CJK JP',serif;color:#2b2420;display:flex;align-items:center;justify-content:center;gap:60px">
    <div style="width:640px;background:#fffaf0;border-top:22px solid #4d6b2a;border-bottom:22px solid #4d6b2a;border-radius:8px;padding:30px 30px;box-shadow:0 16px 40px #5e524840;display:flex;flex-direction:column;gap:14px">
      <div style="font-size:48px;font-weight:800;letter-spacing:10px;text-align:center">桃太郎</div>
      ${row(1, "川を流れてきた大きな桃を拾う")}${row(2, "桃の中から男の子が生まれる")}${row(3, "つぎは？", true)}</div>
    <div style="display:flex;flex-direction:column;gap:18px"><div style="font-size:84px;font-weight:800;letter-spacing:10px">昔話<br>ならべ</div><div style="font-size:30px;color:#5e5248">場面を、お話の順に<br>だれでも同じ1日3話</div></div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
