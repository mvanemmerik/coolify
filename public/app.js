const button = document.getElementById("party-btn");
const fortune = document.getElementById("fortune");
const buildStatus = document.getElementById("build");
const healthStatus = document.getElementById("health");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let isDeploying = false;

const fortunes = [
  "Deploy complete: containers are purring.",
  "Build passed: your stack is vibing.",
  "Green checks across the board. Ship it.",
  "Zero downtime deploy. Coffee reward unlocked.",
  "All services healthy. This is peak platform energy."
];

const confettiColors = ["#ff6b35", "#ffd166", "#06d6a0", "#00b4d8", "#ef476f", "#7353ba"];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function launchConfetti() {
  if (prefersReducedMotion.matches) {
    return;
  }

  const amount = 120;
  for (let i = 0; i < amount; i += 1) {
    const bit = document.createElement("span");
    bit.className = "confetti";
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.background = randomItem(confettiColors);
    bit.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    bit.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    document.body.append(bit);

    setTimeout(() => bit.remove(), 4700);
  }
}

button?.addEventListener("click", () => {
  if (isDeploying) {
    return;
  }

  isDeploying = true;
  button.disabled = true;

  if (buildStatus) buildStatus.textContent = "building...";
  if (healthStatus) healthStatus.textContent = "probing...";

  launchConfetti();
  if (fortune) {
    fortune.textContent = randomItem(fortunes);
  }
  button.textContent = "Deploy Again";

  setTimeout(() => {
    if (buildStatus) buildStatus.textContent = "success";
    if (healthStatus) healthStatus.textContent = "healthy";
    button.disabled = false;
    isDeploying = false;
  }, 900);
});
