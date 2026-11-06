/**
 * "HD-2D" pass (the 64-bit look): the art stays chunky pixel art, but lighting is computed at `f`x the resolution from a smoothed
 * height map (luminance), so every shape gets sub-pixel bevels, highlights from the upper left and soft cavity shadows = volume.
 */
export function hd2d(src: HTMLCanvasElement, dst: HTMLCanvasElement, f = 2, k = 1) {
  const w = src.width, h = src.height, W = w * f, H = h * f;
  if (dst.width !== W) dst.width = W;
  if (dst.height !== H) dst.height = H;
  const sd = src.getContext('2d', {willReadFrequently: true})!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h), ht = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = ((sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11) / 255) * (sd[i * 4 + 3] / 255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { a += lum[yy * w + xx]; n++; } }
    ht[y * w + x] = a / n;
  }
  const smp = (px: number, py: number) => {
    const x = px - 0.5, y = py - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const xa = Math.max(0, Math.min(w - 1, x0)), xb = Math.max(0, Math.min(w - 1, x0 + 1)), ya = Math.max(0, Math.min(h - 1, y0)), yb = Math.max(0, Math.min(h - 1, y0 + 1));
    return (ht[ya * w + xa] * (1 - fx) + ht[ya * w + xb] * fx) * (1 - fy) + (ht[yb * w + xa] * (1 - fx) + ht[yb * w + xb] * fx) * fy;
  };
  const out = new ImageData(W, H), od = out.data;
  for (let Y = 0; Y < H; Y++) {
    const sy = (Y + 0.5) / f, yi = Math.min(h - 1, Math.floor(sy));
    for (let X = 0; X < W; X++) {
      const sx = (X + 0.5) / f, xi = Math.min(w - 1, Math.floor(sx)), si = (yi * w + xi) * 4, o = (Y * W + X) * 4;
      const a = sd[si + 3];
      if (!a) continue;
      const gx = smp(sx + 0.6, sy) - smp(sx - 0.6, sy), gy = smp(sx, sy + 0.6) - smp(sx, sy - 0.6);
      const lit = -(gx * 0.6 + gy * 0.8) * k * 1.9;                                               // light from the upper left
      const cav = (smp(sx, sy) - (smp(sx - 1.6, sy - 1.6) + smp(sx + 1.6, sy + 1.6)) / 2) * k * 0.8; // small cavity shadow
      const m = 1 + lit + cav, spec = lit > 0.18 ? (lit - 0.18) * 160 : 0;
      od[o] = Math.max(0, Math.min(255, sd[si] * m + spec));
      od[o + 1] = Math.max(0, Math.min(255, sd[si + 1] * m + spec));
      od[o + 2] = Math.max(0, Math.min(255, sd[si + 2] * m + spec));
      od[o + 3] = a;
    }
  }
  dst.getContext('2d')!.putImageData(out, 0, 0);
}
