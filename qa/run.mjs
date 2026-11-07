// 昔話ならべの検査。お話のデータの形・今日の3話と上級の組み方（3年分・過去の日が変わらない）・場面の選び方とカードの並び・とことんの並び（何百回）・通しで遊ぶ・まちがい・ヒント・続きから・上級・練習・あとから・実績・お話帳・記録の読み合わせ・スマホ幅・PWA・引き継ぎ・見やすさ。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
const G = createRequire(import.meta.url)(path.join(root, "game.js"));
const html = readFileSync(path.join(root, "index.html"), "utf8");
const gameSrc = readFileSync(path.join(root, "game.js"), "utf8");
const dataSrc = readFileSync(path.join(root, "data.js"), "utf8");
const KEY = "mukashi-narabe-v1"; // gitleaks:allow 記録の名前（鍵ではない）
const day = (n) => new Date(Date.parse(G.EPOCH) + n * 864e5).toISOString().slice(0, 10);
const T = G.TALES;

// 1. お話のデータ（ブラウザを使わない）
{
  const bad = [];
  for (const t of T) {
    if (!t.t || !/^[ぁ-んー]+$/.test(t.y)) bad.push("題・読み:" + t.t);
    if (!Array.isArray(t.s) || t.s.length !== 7 || t.s.some((x) => !x || x.length > 32) || new Set(t.s).size !== 7) bad.push("場面:" + t.t);
    if (!t.k || t.k.length > 40) bad.push("教え:" + t.t);
    if (t.a && !/^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/card\d+\.html$/.test(t.a)) bad.push("青空文庫:" + t.t);
  }
  check("お話のデータの形（題・ひらがなの読み・場面7つで1つ32字以内・教え40字以内・青空文庫のリンク）", bad.length === 0, bad.slice(0, 5).join(" / "));
  check("同じ題のお話が二つ無い", new Set(T.map((t) => t.t)).size === T.length);
  check("お話は25以上（好きなだけ遊べる数。game-dev.md F6）", T.length >= 25, T.length);
  check("番号（id）は0から順に並ぶ（今日の問題の番号。足すのは最後だけ）", T.every((t, i) => t.id === i));
  check("同じ文の場面が、ほかのお話にも無い（どのお話の場面か迷わない）", new Set(T.flatMap((t) => t.s)).size === T.length * 7);
  check("妖怪・神話のお話を入れない（神話・妖怪のゲームと分ける）", !/雪女|酒呑童子|因幡|八岐|河童|天狗|やまんば|山姥|鬼婆/.test(T.map((t) => t.t).join("")));
}
// 2. 今日の3話・上級（3年分）
{
  const bad = [], seen = new Set();
  for (let n = 0; n < 365 * 3; n++) {
    const k = day(n), d = G.dailyList(k), h = G.hardList(k), ids = d.concat(h).map((q) => q.t);
    if (d.length !== 3 || h.length !== 2 || new Set(ids).size !== 5) bad.push(k + ":数・重なり");
    if (d.map((q) => q.deal.length).join() !== "4,5,6" || d.some((q) => !q.first || q.s[0] !== 0)) bad.push(k + ":今日の枚数");
    if (h.some((q) => q.first || q.s.length !== 7 || q.deal.length !== 7)) bad.push(k + ":上級の枚数");
    if (d.concat(h).some((q) => !G.valid(q) || q.t > G.DAILY_MAX_ID)) bad.push(k + ":形");
    if (d.concat(h).some((q) => q.deal.length >= 3 && (q.deal.join() === (q.first ? q.s.slice(1) : q.s).join() || q.deal.join() === (q.first ? q.s.slice(1) : q.s).slice().reverse().join()))) bad.push(k + ":カードがお話の順のまま");
    if (n < 30) ids.forEach((t) => seen.add(t));
  }
  check("今日の3話は毎日 カード4・5・6枚（はじめの場面は見せる）、上級は7枚×2話、5話とも重ならない・カードはお話の順のまま・逆順のままにしない（3年分）", bad.length === 0, bad.slice(0, 5).join(","));
  const gap = { m: 1e9 }, last = new Map();
  for (let n = 0; n < 365 * 3; n++) for (const q of G.dailyList(day(n))) { if (last.has(q.t)) gap.m = Math.min(gap.m, n - last.get(q.t)); last.set(q.t, n); }
  check("同じお話が次に今日の3話に出るまで4日以上あく（つなぎ目でもすぐ戻さない。3年分）", gap.m >= 4, gap.m);
  check("30日で全部のお話が出る", seen.size === G.DAILY_MAX_ID + 1, seen.size);
  // 過去と先の日の問題が変わらない（データを足しても・作り方を直しても。F7）。値は 2026-11-07 に作った
  const snap = createHash("sha256").update(JSON.stringify([...Array(120)].map((_, n) => [G.dailyList(day(n)), G.hardList(day(n))]))).digest("hex").slice(0, 16);
  check("はじめの120日の今日の3話・上級は前と同じ（変えると過去の日の問題が変わる）", snap === "816e671095b38abc", snap);
  check("乱数は sort の比較の中で引かない", !/sort\([^)]*r\(\)/.test(gameSrc + html));
  check("Math.random は練習・とことんの並びと回の名札だけ（game.js には無い・index.html に5か所）", !/Math\.random/.test(gameSrc + dataSrc) && (html.match(/Math\.random/g) || []).length === 5, (html.match(/Math\.random/g) || []).length);
}
// 3. とことん・練習（何百回）
{
  const bad = [];
  for (let t = 0; t < 400; t++) {
    const r = G.rng(G.seedOf("qa-e:" + t)), avoid = t % 3 ? t % T.length : undefined, from = (t % 4) * 9, L = G.endlessList(r, avoid, from);
    if (L.length !== T.length || new Set(L.map((q) => q.t)).size !== T.length) { bad.push(t + ":数"); continue; }
    if (avoid !== undefined && L[0].t === avoid) bad.push(t + ":つなぎ目");
    L.forEach((q, j) => { const n = G.endlessSize(from + j); if (!G.valid(q) || q.s.length !== (n < 7 ? n + 1 : 7) || q.deal.length !== n || (q.deal.length >= 2 && q.deal.join() === (q.first ? q.s.slice(1) : q.s).join())) bad.push(t + ":" + j); });
  }
  check("とことん：全部のお話を1回ずつ・続けて同じお話を出さない・カードは4枚から3話ごとに1枚ふやし7枚まで（400回）", bad.length === 0, bad.slice(0, 5).join(","));
  const pb = [];
  for (let t = 0; t < 300; t++) { const q = G.practiceQ(t % T.length, G.rng(G.seedOf("qa-p:" + t)), t % 2 === 1); if (!G.valid(q) || q.t !== t % T.length || (t % 2 ? q.deal.length !== 7 : q.deal.length !== 6)) pb.push(t); }
  check("練習：選んだお話を、6枚（はじめを見せる）か7枚全部で（300回）", pb.length === 0, pb.slice(0, 5).join(","));
  check("こわれた問題は使わない（valid）", !G.valid({ t: 99, s: [0], deal: [] }) && !G.valid({ t: 0, first: true, s: [0, 2, 1], deal: [2, 1] }) && !G.valid({ t: 0, first: true, s: [0, 1, 2], deal: [1, 3] }));
  check("★：まちがい＋ヒント 0で★3・1で★2・2以上で★1", G.starsOf({ m: 0, h: 0 }) === 3 && G.starsOf({ m: 1, h: 0 }) === 2 && G.starsOf({ m: 0, h: 1 }) === 2 && G.starsOf({ m: 1, h: 1 }) === 1);
}
// 4. 決まりの言葉（好きなだけ遊べる・お笑いを入れない・外へ送らない）
{
  const vis = html.replace(/<!-- a11y:begin[\s\S]*?<!-- a11y:end -->/, "");
  check("チケット・回数制限・🔒で開くモードが無い（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒|スタミナ|あと\d+回/.test(vis));
  check("お笑いの言葉を入れない（本物っぽさ優先）", !/（笑）|ツッコミ|ボケ|爆笑|w{3}(?!\.)/.test(vis + dataSrc));
  check("外へ通信しない（CSP の connect-src は 'self' だけ・fetch を使わない）", /connect-src 'self';/.test(html) && !/fetch\(|XMLHttpRequest|sendBeacon/.test(vis + gameSrc));
  check("Ko-fi はただのリンクだけ（スクリプトを入れない）", !/ko-fi\.com\/widgets|<script[^>]+ko-fi/i.test(html));
  const sw = readFileSync(path.join(root, "sw.js"), "utf8"), shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても4秒で保存したものを返す・ふつうはネットの返事", st.ok, JSON.stringify(st)); }
  check("PWA：sw.js の SHELL に画面のファイルが全部ある・取り直して保存する（cache: reload）", ["./", "./index.html", "./data.js", "./game.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && /CACHE = "mukashi-narabe-/.test(sw));
  const mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  check("PWA：manifest の名前・アイコン（192・512・maskable）", mf.name === "昔話ならべ" && mf.icons.length === 3 && mf.icons.some((i) => i.purpose === "maskable"));
  check("記録の名前の行に gitleaks:allow がある", html.split("\n").concat(readFileSync(path.join(root, "qa/run.mjs"), "utf8").split("\n")).filter((l) => l.includes(KEY) && !l.includes("filter((l) => l.includes(KEY)")).every((l) => /gitleaks:allow/.test(l)));
}

// 5. ブラウザで遊ぶ
let browser;
const errors = [];
async function newPage(opt = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, locale: "ja-JP" }, opt));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto(url);
  return p;
}
const closeHow = (p) => p.evaluate(() => { const d = document.getElementById("howto"); if (d.open) document.getElementById("howto-ok").click(); });
const cur = (p) => p.evaluate(() => { const c = window.__mk.cur(); return c && { t: c.q.t, n: c.q.deal.length, p: c.p, m: c.m, h: c.h, done: c.done, mode: c.mode, i: c.i, next: c.done ? null : window.__mk.next(), deal: c.q.deal }; });
async function tapNext(p) { const c = await cur(p); await p.click(`#cards button[data-c="${c.next}"]`); }
async function solveCur(p) { for (let g = 0; g < 10; g++) { const c = await cur(p); if (c.done) break; await tapNext(p); } await p.waitForSelector("#next"); }
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await newPage();
  check("はじめて開くと遊び方が出る", await page.evaluate(() => document.getElementById("howto").open));
  { const p0 = await newPage(); let bad = 0;
    for (let j = 0; j < 10; j++) { await p0.evaluate((K) => localStorage.removeItem(K), KEY); await p0.reload(); await p0.keyboard.press("Escape"); if (await p0.evaluate((K) => !(JSON.parse(localStorage.getItem(K) || "{}").tut), KEY)) bad++; await p0.reload(); if (await p0.evaluate(() => document.getElementById("howto").open)) bad++; }
    await p0.evaluate((K) => localStorage.removeItem(K), KEY); await p0.reload(); await p0.click("#howto-ok");
    const atOnce = await p0.evaluate((K) => !!(JSON.parse(localStorage.getItem(K) || "{}").tut), KEY);
    check("遊び方：Esc で閉じても「見た」が残り、すぐ読み直しても出ない（10回）・「わかった」を押したその場で残る", bad === 0 && atOnce, bad);
    await p0.close(); }
  await closeHow(page);
  check("ホーム：今日の3話・とことん・上級・練習・お話帳・実績・カレンダーのボタンが最初から押せる", await page.evaluate(() => ["go-d", "go-e", "go-h", "go-p", "go-dex", "go-ach", "go-cal"].every((id) => { const b = document.getElementById(id); return b && !b.disabled; })));
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url); const d2 = await p2.evaluate(() => JSON.stringify(window.MKG.dailyList("2026-12-24"))); await ctx.close(); check("同じ日は別のブラウザで開いても同じ3話", d2 === JSON.stringify(G.dailyList("2026-12-24"))); }
  await page.click("#go-d");
  const k = await page.evaluate(() => window.__mk.todayKey());
  let c = await cur(page);
  check("今日の3話の1話目：題・はじめの場面（見せる）・空いた所・カード4枚・ヒント", c.t === G.dailyList(k)[0].t && (await page.locator("#line li.given").count()) === 1 && (await page.locator("#line li.empty").count()) === 4 && (await page.locator("#cards button").count()) === 4 && !!(await page.$("#hint")), JSON.stringify(c));
  const wrong = c.deal.find((x) => x !== c.next);
  await page.click(`#cards button[data-c="${wrong}"]`);
  await page.waitForTimeout(80);
  c = await cur(page);
  check("順がちがうカードを押すと「✕」の知らせ（文字）が出て、まちがいが1つ増え、カードは置かれない", c.m === 1 && c.p === 0 && (await page.textContent("#live")).includes("✕"));
  await page.click("#hint");
  check("ヒント：次のカードに 👉（破線の枠・読み上げにも「ヒント」）が付く", (await page.locator("#cards button.hint").count()) === 1 && (await page.getAttribute("#cards button.hint", "data-c")) === String(c.next) && /ヒント/.test(await page.getAttribute("#cards button.hint", "aria-label")) && (await page.locator("#hint").isDisabled()));
  await tapNext(page);
  c = await cur(page);
  check("正しいカードを押すと絵巻の次の所に書かれ、カードが1枚へる・ヒントの印は消える", c.p === 1 && (await page.locator("#line li:not(.empty)").count()) === 2 && (await page.locator("#cards button").count()) === 3 && (await page.locator("#cards button.hint").count()) === 0);
  await solveCur(page);
  check("並べ終えると「✓ できた」・全部の場面の流れ（7つ）・教え・★1（まちがい1＋ヒント1）", await page.evaluate(() => { const v = document.querySelector(".verdict"); return v.textContent.includes("✓ できた") && v.querySelectorAll(".full li").length === 7 && /このお話から/.test(v.textContent) && v.querySelector(".stars").getAttribute("aria-label") === "星1つ"; }));
  const t0 = T[G.dailyList(k)[0].t];
  check("青空文庫で読めるお話には、そのリンクを出す", !t0.a || (await page.locator(`.verdict a[href="${t0.a}"]`).count()) === 1);
  await page.click("#next");
  // 3回続けてまちがえると 👉 が付く（行き止まりにしない）
  c = await cur(page);
  for (let j = 0; j < 3; j++) { const w = (await cur(page)).deal.find((x) => x !== c.next); await page.click(`#cards button[data-c="${w}"]`); }
  check("3回続けてまちがえると、次のカードに 👉 が付く（ヒントの数は増やさない）", (await page.locator("#cards button.hint").count()) === 1 && (await cur(page)).h === 0 && (await cur(page)).m === 3);
  await tapNext(page);
  await page.reload(); await closeHow(page);
  check("途中で閉じても、ホームに「続きから（2話目）」が出る", (await page.textContent("#go-d")).includes("続きから（2話目）"));
  await page.click("#go-d");
  const c2 = await cur(page);
  check("続きからは同じお話で、並べた枚数とまちがいの数もそのまま", c2.t === c.t && c2.p === 1 && c2.m === 3 && c2.i === 1, JSON.stringify(c2));
  await solveCur(page); await page.click("#next");
  await solveCur(page);
  check("3話目のあとは「結果を見る」", (await page.textContent("#next")).includes("結果を見る"));
  await page.click("#next");
  const res = await page.evaluate(() => ({ share: document.querySelector(".share") && document.querySelector(".share").textContent, rows: document.querySelectorAll(".res > div").length, kofi: /Ko-fi でコーヒー/.test(document.getElementById("app").innerText), e: !!document.getElementById("go-e"), h: !!document.getElementById("go-h") }));
  const s1 = await page.evaluate(() => window.__mk.load());
  check("結果：3話の行・シェアの文・続けて遊ぶ（とことん）・上級に挑む", res.rows === 3 && res.e && res.h && !!res.share, JSON.stringify(res));
  check("シェアの文にお話の名前・場面を出さない", G.dailyList(k).every((q) => !res.share.includes(T[q.t].t) && T[q.t].s.every((x) => !res.share.includes(x))) && /🟧/.test(res.share));
  check("今日の記録がつき、出会ったお話が3つ増える", !!s1.days[k] && s1.days[k].r.length === 3 && Object.keys(s1.seen).length === 3);
  check("まちがいのある日は Ko-fi の1行を出さない", !res.kofi);
  await page.click("#back");
  check("ホームに「今日の結果を見る」", (await page.textContent("#go-d")).includes("今日の結果を見る"));
  // 上級
  await page.click("#go-h");
  c = await cur(page);
  check("上級：はじめの場面も並べる7枚・ヒントのボタンが無い", c.mode === "h" && c.n === 7 && (await page.locator("#line li.given").count()) === 0 && (await page.locator("#hint").count()) === 0);
  for (let j = 0; j < 3; j++) { const w = (await cur(page)).deal.find((x) => x !== c.next); await page.click(`#cards button[data-c="${w}"]`); }
  check("上級でも3回続けてまちがえると 👉 が付く（行き止まりにしない）", (await page.locator("#cards button.hint").count()) === 1);
  await solveCur(page); await page.click("#next"); await solveCur(page); await page.click("#next");
  check("上級の記録がつく", await page.evaluate(() => { const s = window.__mk.load(); return !!s.hdays[window.__mk.todayKey()] && s.hdays[window.__mk.todayKey()].r.length === 2; }));
  // とことん
  await page.click("#go-e");
  for (let j = 0; j < 4; j++) { await solveCur(page); await page.click("#next"); }
  c = await cur(page);
  check("とことん：4話目からカードが5枚にふえる", c.n === 5, c.n);
  { const w = c.deal.find((x) => x !== c.next); await page.click(`#cards button[data-c="${w}"]`); }
  check("とことん：まちがえても終わらない", !(await cur(page)).done && (await page.locator("#quit").count()) === 1);
  await solveCur(page); await page.click("#next");
  await page.click("#quit");
  check("とことん：「ここで降りる」で終わり、一度で並べた数の自己ベスト（4）を残す", await page.evaluate(() => window.__mk.load().ebest === 4 && /一度で 4話/.test(document.getElementById("app").innerText)));
  check("とことんは今日の記録・連続には数えない", await page.evaluate((d) => JSON.stringify(window.__mk.load().days) === JSON.stringify(d), s1.days));
  await page.click("#go-e");
  await page.evaluate(() => { const s = window.__mk; s.save((x) => { x.runs.e.res = x.runs.e.list.slice(0, -1).map(() => ({ m: 0, h: 0 })); }); s.play("e"); });
  check("とことんはお話が尽きない（並びの最後まで来たら新しい並びをつなげる）", await page.evaluate(() => window.__mk.load().runs.e.list.length >= 2 * window.MKG.TALES.length - 1 && !!window.__mk.cur() && window.__mk.cur().q.deal.length === 7));
  await page.evaluate(() => window.__mk.home());
  // 練習・お話帳
  await page.click("#go-p");
  check("練習：全部のお話から選べる（題を見て選ぶ）", (await page.locator(".res button").count()) === T.length);
  await page.click('.res button[data-t="3"]');
  c = await cur(page);
  check("練習：選んだお話を6枚で", c.t === 3 && c.mode === "p" && c.n === 6);
  await solveCur(page);
  check("練習のあとは「練習のまとめへ」", (await page.textContent("#next")).includes("練習のまとめ"));
  await page.click("#next");
  check("練習は今日の記録に入らない", await page.evaluate((d) => JSON.stringify(window.__mk.load().days) === JSON.stringify(d), s1.days));
  await page.click("#go-dex");
  check("お話帳：出会ったお話は押すと全部の場面が読める、まだのお話は「？？？」（点線）", (await page.locator(".res .no").count()) > 0 && (await page.locator('.res button[data-t="3"]').count()) === 1);
  await page.click('.res button[data-t="3"]');
  check("お話帳のお話：7つの場面と「このお話を並べてみる」", (await page.locator(".line li").count()) === 7 && (await page.locator("#again").count()) === 1);
  await page.close();

  // あとから（取りこぼした日）・カレンダー
  { const p = await newPage();
    await p.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, t: 1 })); }, KEY);
    await p.reload();
    const lt = await p.evaluate(() => window.__mk.lateDays(window.__mk.load()));
    check("取りこぼした日は、はじめの日（" + G.EPOCH + "）より前を出さない・7日まで", lt.every((d) => d >= G.EPOCH) && lt.length <= 7);
    await p.evaluate(() => { const RD = Date, off = 3 * 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    await p.evaluate(() => window.__mk.home()); await p.click("#go-cal");
    const lt2 = await p.evaluate(() => window.__mk.lateDays(window.__mk.load()));
    check("カレンダー：あとから遊べる日は ▶（点線のボタン）", lt2.length > 0 && (await p.locator(`.cal button[data-k="${lt2[0]}"]`).count()) === 1, JSON.stringify(lt2));
    if (lt2.length) {
      const dk = lt2[0];
      await p.click(`.cal button[data-k="${dk}"]`);
      const ca = await cur(p);
      check("あとから：その日の今日の3話と同じお話", ca.mode === "a" && ca.t === G.dailyList(dk)[0].t);
      for (let j = 0; j < 3; j++) { await solveCur(p); await p.click("#next"); }
      const sl = await p.evaluate(() => window.__mk.load());
      check("あとから：記録は late に入り、今日の記録（days）には入らない・シェアは出さない", !!sl.late[dk] && !sl.days[dk] && !(await p.locator(".share").count()));
    }
    await p.close(); }

  // 実績
  { const p = await newPage();
    await p.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, seen: { 0: 1, 1: 1, 2: 1 }, t: 1 })); }, KEY);
    await p.reload();
    const al = await p.evaluate(() => window.__mk.achList(window.__mk.load()));
    check("実績は10〜14個", al.length >= 10 && al.length <= 14, al.length);
    await p.click("#go-ach");
    check("実績の画面：取った ★・まだ ☆ と進み具合", (await p.textContent(".achs")).includes("★ はじめの一話") && (await p.textContent(".achs")).includes("いま 3/5"));
    await p.close(); }

  // 全部一度で並べた日は Ko-fi の1行（今日の3話を初めて終えたときだけ）
  { const p = await newPage(); await closeHow(p);
    await p.click("#go-d");
    for (let j = 0; j < 3; j++) { await solveCur(p); await p.click("#next"); }
    check("全部一度で並べた日は、結果の画面の下に Ko-fi の1行（ただのリンク）", (await p.locator('a[href="https://ko-fi.com/satouaaaaa"]').count()) >= 2 && /Ko-fi でコーヒー/.test(await p.innerText("#app")) && /全部一度で/.test(await p.textContent(".share")));
    await p.click("#back"); await p.click("#go-d");
    check("結果をもう一度見ても Ko-fi の1行は出さない", !/Ko-fi でコーヒー/.test(await p.innerText("#app")));
    await p.close(); }

  // 古いタブ・記録の読み合わせ
  { const p = await newPage(); await closeHow(p);
    await p.click("#go-d");
    const r = await p.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)); s.runs.d.id = "other"; localStorage.setItem(K, JSON.stringify(s)); window.__mk.pick(window.__mk.next()); return window.__mk.load().runs.d.cur; }, KEY);
    check("別のタブで回が変わっていたら、古いタブの操作を記録しない", !r);
    check("保存に失敗したあと別のタブが保存しても、両方の日ごとの結果を残し、数は大きいほう", await p.evaluate((K) => { const s0 = window.__mk.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": { r: [] } }, seen: { 3: 9 }, ebest: 7 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": { r: [] } }, seen: { 3: 2 }, ebest: 3 }))); const r = window.__mk.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.seen[3] === 9 && r.ebest === 7; }, KEY));
    check("同じ回の途中経過は、進んだほう（新しく保存したタブが遅れていても）", await p.evaluate((K) => { const s0 = window.__mk.load(), base = { mode: "d", date: "2000-01-01", list: [], id: "x" }; mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }] }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { res: [] }) } }))); const r = window.__mk.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("こわれた記録でも画面が出る（入れ物を補う）", await p.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, days: 5, seen: null, runs: "x" })); try { window.__mk.home(); return !!document.getElementById("go-d"); } catch (e) { return false; } }, KEY));
    check("保存してあった問題がこわれていたら、使わずにホームへ戻る", await p.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, runs: { p: { mode: "p", date: "x", id: "z", res: [], list: [{ t: 0, first: true, s: [0, 9], deal: [9] }] } } })); window.__mk.play("p"); return !!document.getElementById("go-d") && !window.__mk.load().runs.p; }, KEY));
    await p.close(); }

  // スマホ幅 320px・押せる所の大きさ
  { const p = await newPage({ viewport: { width: 320, height: 640 } }); await closeHow(p);
    const over = async () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const small = async () => p.evaluate(() => [...document.querySelectorAll("button,a,input")].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height && r.height < 44 && !b.closest(".a11y-dlg") && getComputedStyle(b).visibility !== "hidden"; }).map((b) => b.id || b.textContent.trim().slice(0, 10)));
    const o1 = await over(), s1b = await small();
    await p.click("#go-h");
    const o2 = await over(), s2 = await small();
    await p.evaluate(() => window.__mk.startRun("p", window.MKG.TALES.reduce((a, t) => (t.s.join("").length > a.s.join("").length ? t : a)).id));
    const o3 = await over(), s3 = await small();
    check("幅320pxでも横にはみ出さない（ホーム・上級の7枚・いちばん長いお話）", !o1 && !o2 && !o3);
    check("押せる所は高さ44px以上（ホーム・遊ぶ画面）", !s1b.length && !s2.length && !s3.length, JSON.stringify([s1b, s2, s3]));
    await p.close(); }

  // 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
  { const sample = { [KEY]: JSON.stringify({ v: 1, tut: true, days: { "2026-11-07": { r: [{ m: 0, h: 0 }] } }, hdays: {}, late: {}, seen: { 0: 1, 5: 2 }, one: { 0: 1 }, ebest: 4, runs: {}, ach: {}, kofi: {}, t: 1 }) };
    await checkTransfer({ browser, url, game: "mukashi-narabe", sample, check, open: async (page) => { await page.evaluate(() => { const d = document.getElementById("howto"); if (d.open) d.close(); }); } }); }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  if (browser) await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));
{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 昔話ならべ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
