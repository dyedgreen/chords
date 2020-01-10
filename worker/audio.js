// Worker for analyzing time-series of Fourier spectra

console.log("Audio worker started");

const minNote = -15; // smallest note we are happy to recognize
const maxNote = 20; // highest note we like to render
const bufferSize = 3; // # of frames in a detection buffer

const threshold = 0.6; // probability which counts as 'played'

// These are sent from the main thread
let   hzPerBin = NaN;
let   frequencyBinCount = NaN;

const notes = new Uint8Array(maxNote-minNote);
const buffer = new Uint8Array(maxNote-minNote);
const prob = new Float32Array(maxNote-minNote);

// Helpers to set up note index
function noteIndex(n) {
  const f = 440 * Math.pow(2, n/12);
  return parseInt((f + hzPerBin/2) / hzPerBin);
};

// Receive initial settings
onmessage = function({data}) {
  // Load settings
  hzPerBin = data.hzPerBin;
  frequencyBinCount = data.frequencyBinCount;
  // Generate notes
  for (let n = minNote, i = 0; n < maxNote; n++, i ++)
    notes[i] = noteIndex(n);
  // Start analyzing data
  onmessage = analyze;
};

// Analysis state
let bufferMax = 0;
let bufferTotal = 0;
let frame = 0;

// Conditional probabilities
function condProb(on, idx, max, total, maxIdx) {
  const lambda = 1; // This is a tweak-able parameter
  const m = 4; // This is a tweak-able parameter
  const pow = buffer[idx];
  const avg = total / buffer.length;
  const localMax = Math.max(
    ...buffer.slice(Math.max(0, idx-1), Math.min(idx+2, buffer.length))
  );

  let prob = 1;
  if (on === true) {
    // Higher power is more likely
    prob *= lambda * Math.exp(-lambda*(max-pow)/avg);
    // Local max is more likely
    prob *= lambda * Math.exp(-lambda*Math.abs(localMax - pow));
    // Notes should be somewhat proximate to loudest note
    prob *= lambda*0.5 * Math.exp(-lambda*0.5*Math.abs(maxIdx-idx)/m);
  } else {
    // Higher power is less likely
    prob *= lambda * Math.exp(-lambda*pow/avg);
    // Local max is less likely
    if (pow === localMax) {
      prob *= lambda;
    } else {
      prob *= lambda * Math.exp(-lambda/Math.abs(localMax - pow));
    }
    // Notes far away from global maximum are less likely
    if (maxIdx === idx) {
      prob *= lambda*0.5;
    } else {
      prob *= lambda*0.5 * Math.exp(-lambda*0.5*m/Math.abs(maxIdx-idx));
    }
  }
  return prob;
}

// Collect data points for processing
function analyze({data}) {
  // Copy into our buffer and collect overall stats
  let max = 0;
  let total = 0;
  let maxIdx = 0;
  for (let i = 0; i < notes.length; i ++) {
    const v = data[notes[i]];
    if (max < v) {
      max = v;
      maxIdx = i;
    }
    total += v;
    buffer[i] = v;
  }
  console.log(frame, max, total, total > bufferTotal * 2);
  // We start analyzing the frames if the total power doubles and
  // no analysis is currently ongoing
  if (frame === 0 && total > bufferTotal * 2)
    prob.fill(0.5);
  if (frame > 0 || total > bufferTotal * 2) {
    // Propagate probabilities
    for (let i = 0; i < prob.length; i ++) {
      const on = prob[i] * condProb(true, i, max, total, maxIdx);
      const off = (1-prob[i]) * condProb(false, i, max, total, maxIdx);
      // Bayes step
      prob[i] = on / (on + off);
    }
    // Send results
    frame ++;
    if (frame === 3) {
      frame = 0;
      send();
    }
  }
  // Update global state
  bufferMax = max;
  bufferTotal = total;
}

// Send data to main thread
function send() {
  const result = [];
  for (let i = 0; i < prob.length; i ++) {
    if (prob[i] > threshold)
      result.push(minNote + i);
  }
  // DEBUG: Delete
  console.log(result);
  if (result.length > 0)
    postMessage(result);
}
