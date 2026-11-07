// 昔話ならべの決まり（だれでも同じ今日の3話・上級・場面の選び方と並び・とことんの並び）。画面と検査（qa/run.mjs）の両方から使う。
(function () {
  const D = typeof module !== "undefined" ? require("./data.js") : window.MKD;
  const TALES = D.TALES.map((t, id) => Object.assign({ id }, t));
  // 今日の3話・上級に使うのは、この番号までのお話だけ（あとから足しても過去の日の問題が変わらない）。足した分は練習・とことんに出る
  const DAILY_MAX_ID = 26;
  const EPOCH = "2026-11-07";
  const SIZES = [4, 5, 6]; // 今日の3話：並べるカードの数（はじめの場面は見せる）。上級は7枚全部・はじめの場面も並べる
  const HARD_N = 2;

  // ---- 種と乱数（日本時間の日付から。ここでは端末ごとの乱数を使わない）----
  function seedOf(str) { let h = 2166136261 >>> 0; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // 並べかえ（フィッシャー–イェーツ。sort の比較の中で乱数を引かない）
  function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const dayNo = (k) => Math.round((Date.parse(k) - Date.parse(EPOCH)) / 864e5) + 1;

  // お話の山を周ごとにちがう順に並べる。前の周の終わりの3分の1は、次の周のはじめの3分の1に置かない（つなぎ目ですぐ同じお話を出さない）
  const POOL = TALES.filter((t) => t.id <= DAILY_MAX_ID).map((t) => t.id);
  const perms = new Map();
  function permOf(tag, cyc) {
    const id = tag + ":" + cyc;
    if (perms.has(id)) return perms.get(id);
    let p = shuffle(POOL, rng(seedOf("mukashi:" + id)));
    if (cyc > 0) {
      const prev = permOf(tag, cyc - 1), third = Math.floor(POOL.length / 3), tail = new Set(prev.slice(prev.length - third));
      const head = p.filter((x) => !tail.has(x)).slice(0, third);
      p = head.concat(p.filter((x) => !head.includes(x)));
    }
    perms.set(id, p);
    return p;
  }
  function take(tag, start, k, used) {
    const N = POOL.length, out = [];
    for (let p = start; out.length < k && p < start + N; p++) {
      const id = permOf(tag, Math.floor(p / N))[((p % N) + N) % N];
      if (used.has(id)) continue;
      used.add(id); out.push(id);
    }
    return out;
  }
  // 1つの問題：{ t: お話の番号, s: 並べる場面の番号（お話の順）, first: はじめの場面を見せるか }
  // 場面は、はじめの場面のほかから n 枚を、お話の順のまま選ぶ
  function pickScenes(t, n, r, withFirst) {
    const all = TALES[t].s.map((_, i) => i);
    if (!withFirst) return n >= all.length ? all : shuffle(all, r).slice(0, n).sort((a, b) => a - b);
    const rest = all.slice(1);
    return [0].concat(n >= rest.length ? rest : shuffle(rest, r).slice(0, n).sort((a, b) => a - b));
  }
  // カードの並び：問題ごとに決まった順。お話の順のまま・逆順のままにはしない
  function deal(q, salt) {
    const cards = q.first ? q.s.slice(1) : q.s.slice();
    const r = rng(seedOf("deal:" + salt + ":" + q.t + ":" + q.s.join(",")));
    for (let i = 0; i < 20; i++) {
      const d = shuffle(cards, r);
      if (cards.length < 3 || (d.join() !== cards.join() && d.join() !== cards.slice().reverse().join())) return d;
    }
    return cards.slice(1).concat(cards[0]);
  }
  const dmemo = new Map();
  function dailyList(k) {
    if (dmemo.has(k)) return dmemo.get(k);
    const n = dayNo(k) - 1, ids = take("d", n * 3, 3, new Set());
    const out = ids.map((t, j) => { const q = { t, first: true, s: pickScenes(t, SIZES[j], rng(seedOf("sc:" + k + ":" + j)), true) }; q.deal = deal(q, k); return q; });
    dmemo.set(k, out);
    return out;
  }
  // 上級：2話。7枚全部（はじめの場面も並べる）。今日の3話と同じお話は出さない
  function hardList(k) {
    const used = new Set(dailyList(k).map((q) => q.t));
    return take("h", (dayNo(k) - 1) * HARD_N + 5, HARD_N, used).map((t) => { const q = { t, first: false, s: pickScenes(t, 7, null, false) }; q.deal = deal(q, "h" + k); return q; });
  }
  // ★：まちがい＋ヒントの数（0で★3・1で★2・2以上で★1）
  const starsOf = (r) => { const n = (r.m || 0) + (r.h || 0); return n <= 0 ? 3 : n === 1 ? 2 : 1; };

  // ---- とことん：お話を毎回ちがう順に、カードは4枚から始めて6話ごとに1枚ふやす（7枚まで、9話目から上級と同じ）。1つの並びの中で同じお話は出さない ----
  function endlessSize(i) { return Math.min(7, 4 + Math.floor(i / 3)); }
  function endlessList(r, avoid, from) {
    let ids = shuffle(TALES.map((t) => t.id), r);
    if (avoid != null && ids[0] === avoid) ids = ids.slice(1).concat(ids[0]);
    return ids.map((t, j) => { const n = endlessSize((from || 0) + j), first = n < 7; const q = { t, first, s: pickScenes(t, n, r, first) }; q.deal = shuffle(first ? q.s.slice(1) : q.s, r); if (q.deal.join() === (first ? q.s.slice(1) : q.s).join()) q.deal.reverse(); return q; });
  }
  // 練習：選んだお話を、6枚（はじめの場面を見せる）か7枚全部で
  function practiceQ(t, r, full) { const q = { t, first: !full, s: pickScenes(t, full ? 7 : 6, r, !full) }; q.deal = shuffle(q.first ? q.s.slice(1) : q.s, r); if (q.deal.join() === (q.first ? q.s.slice(1) : q.s).join()) q.deal.reverse(); return q; }
  // 問題の形が正しいか（保存してあった問題を使う前に確かめる）
  function valid(q) {
    if (!q || !TALES[q.t] || !Array.isArray(q.s) || !Array.isArray(q.deal)) return false;
    const L = TALES[q.t].s.length, s = q.s;
    if (!s.every((i, j) => Number.isInteger(i) && i >= 0 && i < L && (j === 0 || i > s[j - 1]))) return false;
    const need = (q.first ? s.slice(1) : s).slice().sort((a, b) => a - b).join();
    return q.deal.slice().sort((a, b) => a - b).join() === need && (!q.first || s[0] === 0);
  }

  const api = { TALES, EPOCH, DAILY_MAX_ID, SIZES, HARD_N, seedOf, rng, shuffle, dayNo, permOf, dailyList, hardList, pickScenes, deal, starsOf, endlessList, endlessSize, practiceQ, valid };
  if (typeof module !== "undefined") module.exports = api; else window.MKG = api;
})();
