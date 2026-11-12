// ドリブル回数カウンター（MediaPipe Pose の33点ランドマークから数える）
// 画面に依存しない純粋なロジック。node でもテストできるようにしている。
//
// 考え方
// - 手首の高さを「肩の中心からの距離 ÷ 胴の長さ」で正規化する（カメラとの距離に左右されない）
// - 手首が「上 → 下」に一定以上動いて、下で折り返したら 1 回とする（ヒステリシス付きの山谷検出）
// - 折り返した位置が腰付近より下でないものは数えない（腕を振っただけ、手を挙げただけを除外）
// - ひざの角度から「低く構えているか」も判定する

const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

export const SENSITIVITY = {
  low:    { amp: 0.20, minBottom: 0.60 },
  normal: { amp: 0.13, minBottom: 0.45 },
  high:   { amp: 0.08, minBottom: 0.30 },
};

const vis = (p) => (p && typeof p.visibility === 'number' ? p.visibility : 1);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function angle(a, b, c) {
  // b を頂点とする角度（度）
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return 180;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d));
  return (Math.acos(cos) * 180) / Math.PI;
}

export class HandTracker {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }
  reset() {
    this.s = null;        // 平滑化した高さ
    this.dir = 0;         // 1: 下がっている途中, -1: 上がっている途中, 0: 不明
    this.top = 0; this.topT = 0;
    this.bottom = 0; this.bottomT = 0;
    this.lastT = 0;
    this.lastCountT = -1e9;
    this.avgStroke = 0;
  }
  // y: 正規化した手首の高さ（大きいほど下）。戻り値: 1回ついたらその振れ幅、つかなければ 0
  // 実際に数えるかどうかは DribbleCounter が決め、数えたら accept() を呼ぶ
  push(t, y) {
    const { amp, minBottom } = this.cfg;
    if (this.s === null || t - this.lastT > 400) {
      // 初回、または見失って 0.4 秒以上たったら仕切り直し
      this.s = y; this.dir = 0;
      this.top = y; this.topT = t;
      this.bottom = y; this.bottomT = t;
      this.lastT = t;
      return false;
    }
    const dt = Math.max(1, t - this.lastT);
    this.lastT = t;
    // フレーム間隔に合わせて平滑化の強さを変える（低フレームレートでも振れ幅を潰さない）
    this.s += (1 - Math.exp(-dt / 35)) * (y - this.s);
    const s = this.s;

    if (this.dir >= 0) {
      // 下がっている（または不明）：いちばん下を追う
      if (s > this.bottom) { this.bottom = s; this.bottomT = t; }
      if (this.bottom - s > amp) {
        // 下で折り返した
        let counted = 0;
        const stroke = this.bottom - this.top;
        const strokeTime = this.bottomT - this.topT;
        if (
          (this.dir === 1 ? stroke > amp : stroke > amp * 1.5) &&
          this.bottom > minBottom &&
          strokeTime < 1500 && strokeTime >= 50 &&
          this.bottomT - this.lastCountT > 160
        ) {
          counted = stroke;
        }
        this.dir = -1;
        this.top = s; this.topT = t;
        return counted;
      }
      if (this.dir === 0 && this.top - s > amp) {
        // 最初に上へ動いた場合
        this.dir = -1; this.top = s; this.topT = t;
      }
    } else {
      // 上がっている：いちばん上を追う
      if (s < this.top) { this.top = s; this.topT = t; }
      if (s - this.top > amp) {
        this.dir = 1;
        this.bottom = s; this.bottomT = t;
      }
    }
    return 0;
  }
  accept(stroke) {
    this.lastCountT = this.bottomT;
    this.avgStroke = this.avgStroke ? this.avgStroke * 0.7 + stroke * 0.3 : stroke;
  }
}

export class DribbleCounter {
  constructor({ sensitivity = 'normal', swapHands = false } = {}) {
    this.cfg = SENSITIVITY[sensitivity] || SENSITIVITY.normal;
    this.swapHands = swapHands;
    this.reset();
  }
  reset() {
    this.hands = { left: new HandTracker(this.cfg), right: new HandTracker(this.cfg) };
    this.total = 0;
    this.left = 0;
    this.right = 0;
    this.lowDribbles = 0;
    this.lastLow = null;
  }
  // lm: 33点の配列（x, y は 0〜1、visibility 付き）
  // 戻り値: { tracked, events: [{hand}], low, legsVisible }
  update(t, lm) {
    const out = { tracked: false, events: [], low: null, legsVisible: false };
    if (!lm || lm.length < 29) return out;
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
    const lh = lm[LM.L_HIP], rh = lm[LM.R_HIP];
    if (Math.min(vis(ls), vis(rs), vis(lh), vis(rh)) < 0.4) return out;
    const sh = mid(ls, rs), hip = mid(lh, rh);
    const torso = dist(sh, hip);
    if (torso < 0.03) return out;
    out.tracked = true;

    // 低さ（ひざの角度）
    const lk = lm[LM.L_KNEE], rk = lm[LM.R_KNEE], la = lm[LM.L_ANKLE], ra = lm[LM.R_ANKLE];
    if (Math.min(vis(lk), vis(rk), vis(la), vis(ra)) > 0.5) {
      out.legsVisible = true;
      const k = (angle(lh, lk, la) + angle(rh, rk, ra)) / 2;
      out.kneeAngle = k;
      out.low = k < 155;
    }
    this.lastLow = out.low;

    const sides = [
      ['left', LM.L_WRIST],
      ['right', LM.R_WRIST],
    ];
    for (const [side, idx] of sides) {
      const w = lm[idx];
      if (!w || vis(w) < 0.3) continue;
      const y = (w.y - sh.y) / torso;
      const tr = this.hands[side];
      const stroke = tr.push(t, y);
      if (!stroke) continue;
      // もう片方の手がドリブル中で、こちらの動きがずっと小さいなら「つられて動いただけ」とみなす
      const other = this.hands[side === 'left' ? 'right' : 'left'];
      if (t - other.lastCountT < 700 && other.avgStroke && stroke < other.avgStroke * 0.5) continue;
      tr.accept(stroke);
      {
        const hand = this.swapHands ? (side === 'left' ? 'right' : 'left') : side;
        this.total++;
        this[hand]++;
        if (out.low) this.lowDribbles++;
        out.events.push({ hand, low: !!out.low });
      }
    }
    return out;
  }
}
