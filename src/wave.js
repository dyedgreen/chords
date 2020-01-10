// Draw a volume indicator wave
export function render(w, h, ctx, power, t) {
  const c = w / 2;
  const n = 40;
  const max = power > 1000 ? 1 : power / 1000;

  // Render waves
  const step = w / n;
  const colors = ["rgba(3, 57, 52, 0.5)", "rgba(10, 209, 189, 0.5)"];

  for (let i = 0; i < colors.length; i ++) {
    ctx.beginPath();
    ctx.fillStyle = colors[i];
    ctx.moveTo(0, h);
    const omega = 3e-3 * (i === 0 ? +1 : -1);
    for (let x = 1; x < n; x ++) {
      const s = Math.sin(0.02 * x*step - omega*t);
      const e = Math.sin(Math.PI * x / n);
      ctx.lineTo(x*step, h - max * h*s*s*e);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
}
