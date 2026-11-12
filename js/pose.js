// カメラで体の位置をとり、ドリブルを数える（MediaPipe Pose）
import { DribbleCounter } from './counter.js';

let landmarker = null; let loading = null;
async function getLandmarker() {
  if (landmarker) return landmarker;
  if (!loading) {
    loading = (async () => {
      const vision = await import('../vendor/vision_bundle.js');
      const fileset = await vision.FilesetResolver.forVisionTasks(new URL('../vendor/wasm', import.meta.url).href);
      const b64 = (await import('../models/pose_model.js')).default;
      const bin = atob(b64); const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const opts = (delegate) => ({ baseOptions: { modelAssetBuffer: buf.slice(), delegate }, runningMode: 'VIDEO', numPoses: 1 });
      try { return await vision.PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch (e) { return await vision.PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
    })();
  }
  try { landmarker = await loading; } catch (e) { loading = null; throw e; }
  return landmarker;
}

// カメラを開く。使えなければ例外を投げる
export async function startPose(video, { sens = 'normal', swap = false } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-camera');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  let lmk;
  try { lmk = await getLandmarker(); } catch (e) { stream.getTracks().forEach((t) => t.stop()); throw e; }
  video.srcObject = stream;
  await video.play().catch(() => {});
  const counter = new DribbleCounter({ sensitivity: sens, swapHands: swap });
  let lastVT = -1; let lastTs = 0;
  return {
    // 毎フレーム呼ぶ。新しい映像がなければ null
    poll() {
      if (video.readyState < 2 || video.currentTime === lastVT) return null;
      lastVT = video.currentTime;
      let ts = performance.now(); if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
      let r; try { r = lmk.detectForVideo(video, ts); } catch (e) { return null; }
      const lm = r && r.landmarks && r.landmarks[0];
      const res = counter.update(ts, lm);
      if (res.tracked && lm) {
        // こしの位置：本人から見て右が＋（カメラ映像では左右が逆）。肩はば・胴の長さで割って距離の影響をなくす
        const shW = Math.abs(lm[11].x - lm[12].x) || 0.1; const torso = Math.abs((lm[23].y + lm[24].y) / 2 - (lm[11].y + lm[12].y) / 2) || 0.2;
        res.hx = -(((lm[23].x + lm[24].x) / 2) / shW) * (swap ? -1 : 1); res.hy = ((lm[23].y + lm[24].y) / 2) / torso;
      }
      return res;
    },
    stop() { stream.getTracks().forEach((t) => t.stop()); try { video.pause(); video.srcObject = null; } catch (e) { /* noop */ } },
  };
}
