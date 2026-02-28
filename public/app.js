const button = document.getElementById("party-btn");
const fortune = document.getElementById("fortune");

const fortunes = [
  "Your lucky color today: Sunset Orange",
  "Your lucky color today: Ocean Teal",
  "Your lucky color today: Mint Glow",
  "Your lucky color today: Mango Gold",
  "Your lucky color today: Sky Blue"
];

const confettiColors = ["#ff6b35", "#ffd166", "#06d6a0", "#00b4d8", "#ef476f", "#7353ba"];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function launchConfetti() {
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
  launchConfetti();
  fortune.textContent = randomItem(fortunes);
  button.textContent = "Party Again";
});
