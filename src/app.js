import { AudioAnalyzer } from "./audio.js";
import { render } from "./wave.js";

const chordRender = document.getElementById("chord-render");
const chordInfo = document.getElementById("chord-info");

const viewStart = document.getElementById("view-start");
const viewError = document.getElementById("view-error");
const viewChord = document.getElementById("view-chord");
const viewHelp = document.getElementById("view-help");

const volumeIndicator = document.getElementById("waves");

document.getElementById("btn-start").addEventListener("click", () => {
  AudioAnalyzer.open()
  .then(analyzer => {
    // Show chords and hide start prompt
    viewStart.classList.add("hidden");
    viewChord.classList.remove("hidden");
    // Display recognized chords
    analyzer.onchord = chord => {
      chordRender.innerHTML = chord.svg();
      chordInfo.innerHTML = chord.name;
    };
    analyzer.onpower = power => {
      nPower = power;
    };
  })
  .catch(() => {
    // Access rejected or no audio input available
    viewStart.classList.add("hidden");
    viewError.classList.remove("hidden");
  });
});

document.getElementById("btn-help").addEventListener("click", () => {
  viewHelp.classList.toggle("hidden");
});

// Volume animation
let nPower = 0;
let cPower = 0;

volumeIndicator.height = 100;
const volumeCtx = volumeIndicator.getContext("2d");

function animateVolume() {
  volumeIndicator.width = viewChord.offsetWidth;
  // Interpolate power
  cPower = (cPower*1.5 + nPower*0.5) / 2;
  // Render wave
  if (cPower > 1e-5)
    render(volumeIndicator.width, 100, volumeCtx, cPower, Date.now());
  window.requestAnimationFrame(animateVolume);
};
animateVolume();
