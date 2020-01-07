// Worker for analyzing time-series of Fourier spectra

console.log("Audio worker started");

const minNote    = -22; // smallest note with unique bin
const maxNote    = 88-5*12; // highest key on piano
const minPower   = 30; // check what is good ...
const timeWindow = 10; // # of frames in time window

// Time buffer for notes
const bufferOct = []; // contains octave relative to A_4.
                      // i.e. nth index is m <-> note = n + 12 * m
const bufferPow = []; // contains power for octaves
for (let i = 0; i < timeWindow; i ++) {
  bufferOct.push(new Int8Array(12));
  bufferPow.push(new Uint8Array(12));
}
let bufferIdx = 0; // Current position in buffer
clearBuffer();

// Settings needed to be known
let settings = {
  timeStep: null,
  hzPerBin: null,
  frequencyBinCount: null,
  isNote: null,
  notes: null,
};

// Receive initial settings
onmessage = function({data}) {
  settings = data;
  // Generate notes
  notes = new Int8Array(settings.frequencyBinCount);
  isNote = new Uint8Array(settings.frequencyBinCount);
  for (let n = minNote; n < maxNote; n ++) {
    notes[freqIndex(noteFreq(n))] = n;
    isNote[freqIndex(noteFreq(n))] = 1;
  }
  settings.notes = notes;
  settings.isNote = isNote;
  onmessage = collect;
};

let num = 0; // DELETE ME

// Collect new data point
function collect({data}) {
  detectPeaks(data);
  if (bufferIdx === bufferOct.length)
    finalizeBuffer();
}

// Edge detection algorithm - sketch (SINGLE CHORD, 1s timeout)
// 1) if there suddenly are notes, fill a 1 second buffer (i.e. a 10 frame buffer)
//    -> note: for time series collection, this needs to be rethought (!)
//    -> (if time-series collection is possible ...)
// 2) at each point in time in the buffer, record the highest power note at each key
// 3) after the buffer is filled, select notes that have 2+ or 3+ entries
// 4) report these notes as the chord

// octave errors:
// > To correct, apply this rule: if the second peak amplitude below
// > initially chosen pitch is approximately 1/2 of the chosen pitch
// > AND the ratio of amplitudes is above a threshold (e.g., 0.2 for 5
// > harmonics), THEN select the lower octave peak as the pitch for
// > the current frame.
//
// select lowest if the next one is ~0.5 of previous

// Zero powers in octave buffer
function clearBuffer() {
  for (let i = 0; i < bufferOct.length; i ++) {
    bufferPow[i].fill(0);
  }
  bufferIdx = 0;
}

// Detect peaks, write to buffer if any detected
// or buffer has data. The main caller has to finalize
// the buffer whenever it is completely full.
function detectPeaks(spectrum) {
  // Find average spectrum
  let avg = 0;
  for (let i = 0; i < spectrum.length; i ++) {
    avg += spectrum[i];
  }
  avg /= spectrum.length;

  // Notes above average spectrum are set in buffer (todo: optimize this ...)
  let added = false;
  for (let i = 1; i < spectrum.length-1; i ++) {
    if (!settings.isNote[i])
      continue;

    const pow = spectrum[i];
    if (pow < avg + 10) // *magic number 10* (TODO: twiddle ...)
      continue;

    // Not a peak ...
    if (spectrum[i-1] >= spectrum[i] || spectrum[i] <= spectrum[i+1])
      continue;

    // Determine note
    const n = settings.notes[i];
    const key = (120 + n) % 12;

    // If peak bigger than current note in buffer, write to buffer
    if (bufferPow[bufferIdx][key] < pow * 1.2) {
      bufferPow[bufferIdx][key] = pow;
      bufferOct[bufferIdx][key] = n >= 0 ? parseInt(n / 12) : parseInt(n / 12) - 1; // relative to A_4
      added = true;
    }
  }

  // If notes were added, or buffer is not empty
  // fill up the buffer
  if (added || bufferIdx > 0)
    ++bufferIdx;
}

// Extract chord from full buffer. This uses
// (big) discretized time-steps. Later, I want
// to experiment with reporting notes continuously.
function finalizeBuffer() {
  // Debug output: select every note found in spectrum + how often is is seen
  const powers = finalizeBuffer._power_map;
  powers.clear();

  for (let idx = 0; idx < bufferOct.length; idx ++) {
    for (let key = 0; key < 12; key ++) {
      const n = key + 12 * bufferOct[idx][key];
      const total = powers.get(n) | 0;
      powers.set(n, total + bufferPow[idx][key]);
    }
  }

  const res = [];
  for (const [n, pow] of powers)
    res.push([noteName(n), n, pow]);

  let avg = 0;
  for (let i = 0; i < res.length; i ++)
    avg += Math.pow(res[i][2], 2); // raised to 2nd /!\
  avg /= res.length;

  if (avg > 10_000) {
    // Accept chord
    console.log(avg);
    console.log("RAW:", res);
    console.log(res.filter(([,,pow]) => Math.pow(pow, 2) > avg));
  }

  clearBuffer();
}
finalizeBuffer._power_map = new Map();

// Edge detection (CONTINOUS, EMITS NOTES)
// todo (...) -> problem, data is too unreliable at the moment :(

// Note: Maybe use Bayesian / other simple probabilistic model which
//       predicts if a signal is correct/ fake based on previous points,
//       neighboring points. This might mask the errors well enough to do
//       continuous analysis ...
//       (this might then also allow to capture multiple tones simultaneously!)
//
// SIGNALS for Bayes rule:
//  - relative power (higher power -> more likely)
//  - number of occurrences (occurred in previous frames -> more likely)
//  - maybe power is monotonously decreasing -> more likely (as the chords ring out ...)
//  - relative power to other tones of same type (to remove overtones)
//
// however, the above algorithm seems to be a good first draft

// Random stuff from before
// (some this analysis might be moved to C once it works ...)

function freqIndex(f) {
  return parseInt((f + settings.hzPerBin/2) / settings.hzPerBin);
};
function indexFreq(i) {
  return settings.hzPerBin * i - settings.hzPerBin/2;
}

// Use double average as thresh-hold
// This gives reasonable results so far ...
function _____getPeaks(buffer) {
  let peaks = [];
  let avg = buffer[0] + buffer[buffer.length-1];

  // Get peaks that are notes and average peak
  for (let i = 1, max = buffer.length-1; i < max; i ++) {
    if (settings.isNote[i] && buffer[i] > minPower && buffer[i-1] < buffer[i] && buffer[i] > buffer[i+1])
      peaks.push(i);
    avg += buffer[i];
  }
  avg /= buffer.length;

  // Select those notes which have more than average power
  peaks = peaks.filter(i => buffer[i] > avg);

  // Select those peaks which higher than average peak amongst the peaks themselves
  avg = 0;
  for (let i of peaks)
    avg += buffer[i];
  avg /= peaks.length;
  peaks = peaks.filter(i => buffer[i] > avg);

  return removeOvertones(buffer, peaks);
}

// Remove overtones from peaks list
// this is quite slow at the moment...
// -> removes any notes played with non-max power
const _removeOvertones_map = new Map();
const _removeOvertones_res = new Set();
function ______removeOvertones(buffer, peaks) {
  const res = _removeOvertones_res;
  const seen = _removeOvertones_map;
  seen.clear();
  res.clear();
  for (let i = 0; i < peaks.length; i ++) {
    // make this better ...
    const n = (120 + settings.notes[peaks[i]]) % 12;
    if (seen.has(n) && seen.get(n) > buffer[peaks[i]])
      continue;
    seen.set(n, buffer[peaks[i]]);
    res.add(peaks[i]);
  }
  return [...res];
}

// Frequency of note, where n is number
// of half-tone steps between A_4 and the
// note.
// E.g. C_3 <=> n=-10
// Note: 88 key piano goes from
// A_{-1} to C_7 or
// n = -5*12 to n = 88-5*12-1
function noteFreq(n) {
  return 440 * Math.pow(2, n/12);
}

// Ahrg, I'm going crazy ...
function noteName(n) {
  const octave = (n >= 0 ? parseInt(Math.abs(n) / 12) : -1 - parseInt(Math.abs(n) / 12)) + 4;
  // note from friend: seems like it will 'look good' if we maximize distance from lower note
  //                   in letter system (?) but in principle, no right/wrong for single note
  const letters = ['A','#A','B','C','#C','D','#D','E','F','#F','G','#G'];
  // min n is -5*12
  return `${letters[(5*12+n)%12]} (${octave})`;
}
