import { AudioAnalyzer } from "./audio.js";

const chordRender = document.getElementById("chord-render");
const chordInfo = document.getElementById("chord-info");

const viewStart = document.getElementById("view-start");
const viewError = document.getElementById("view-error");
const viewChord = document.getElementById("view-chord");
const viewHelp = document.getElementById("view-help");

document.getElementById("btn-start").addEventListener("click", () => {
  AudioAnalyzer.open()
  .then(analyzer => {
    // Show chords and hide start prompt
    viewStart.classList.add("hidden");
    viewChord.classList.remove("hidden");
    // Display recognized chords
    analyzer.onchord = chord => {
      // TODO: Delete
      chordRender.innerHTML = chord.svg;
      chordInfo.innerHTML = chord.name;
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
