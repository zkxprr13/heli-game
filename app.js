console.log("SMOKE TEST main.js running");

const timerEl = document.getElementById("timer");
if (timerEl) timerEl.textContent = "JS OK";

const badge = document.createElement("div");
badge.textContent = "SMOKE TEST ✅ main.js работает";
badge.style.position = "fixed";
badge.style.left = "12px";
badge.style.top = "12px";
badge.style.zIndex = "99999";
badge.style.background = "rgba(0,0,0,0.7)";
badge.style.color = "white";
badge.style.padding = "8px 10px";
badge.style.borderRadius = "10px";
badge.style.fontFamily = "system-ui, sans-serif";
document.body.appendChild(badge);

const start = Date.now();
setInterval(() => {
  const s = Math.floor((Date.now() - start) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  if (timerEl) timerEl.textContent = `${mm}:${ss}`;
}, 250);

// просто красим canvas, чтобы точно видеть, что он есть
const canvas = document.getElementById("game");
if (canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2b2d42";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff00ff";
  ctx.font = "20px system-ui";
  ctx.fillText("Canvas OK ✅", 20, 80);
}

window.addEventListener("resize", () => {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2b2d42";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff00ff";
  ctx.font = "20px system-ui";
  ctx.fillText("Canvas OK ✅", 20, 80);
});
