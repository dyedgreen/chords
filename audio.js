// Try to get raw audio bytes
async function getAudioStream() {
  const worker = new Worker("./audio_worker.js");

  const bufferSize   = 4096; // smallest 2^N which has decent resolution ...
  const minNote      = -22; // smallest note with unique bin
  const maxNote      = 88-5*12; // highest key on piano

  // Create audio pipeline
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context      = new AudioContext();
  const stream       = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
  const source       = context.createMediaStreamSource(stream);
  const fft          = context.createAnalyser();
  const processor    = context.createScriptProcessor(bufferSize, 1, 1);

  // FFT settings
  fft.fftSize = bufferSize;
  fft.smoothingTimeConstant = 0.2; // TODO: Adjust ...
  fft.minDecibels = -80;//-58; // TODO: Adjust ...

  // Connect audio nodes
  source.connect(fft);
  fft.connect(processor);
  processor.connect(context.destination);

  // Buffer for fft results
  const buffer = new Uint8Array(fft.frequencyBinCount);

  const hzPerBin = (context.sampleRate) / (2*fft.frequencyBinCount);
  function freqIndex(f) {
    return parseInt((f + hzPerBin/2) / hzPerBin);
  };
  function indexFreq(i) {
    return hzPerBin * i - hzPerBin/2;
  }

  // Generate frequencies at each bin and if they are a musical note
  const freqs = new Float32Array(fft.frequencyBinCount);
  for (let i = 0; i < fft.frequencyBinCount; i ++)
    freqs[i] = indexFreq(i);

  for (let n = -5*12; n < 88-5*12; n ++) {
    const f = noteFreq(n);
    const i = freqIndex(f);
    console.log(n, i, f, freqs[i]);
  }

  const isNote = new Uint8Array(fft.frequencyBinCount);
  const notes = new Int8Array(fft.frequencyBinCount);
  for (let n = minNote; n < 88-5*12; n ++) {
    const f = noteFreq(n);
    isNote[freqIndex(f)] = 1;
    notes[freqIndex(f)] = n;
  }

  for (let i = 0; i < freqs.length; i ++) {
    if (!isNote[i])
      continue;
    console.log("2nd pass", i, notes[i], freqs[i], noteFreq(notes[i]));
  }

  // Original
  function getPeaksSimple(buffer) {
    const peaks = [];
    let avg = buffer[0] + buffer[buffer.length-1];
    for (let i = 1, max = buffer.length-1; i < max; i ++) {
      if (buffer[i-1] < buffer[i] && buffer[i] > buffer[i+1])
        peaks.push(i);
      avg += buffer[i];
    }
    avg /= buffer.length;
    console.log(peaks.filter(i => isNote[i]).map(i => [buffer[i], notes[i]]));
    return peaks.filter(i => isNote[i] && buffer[i] > avg);
  }

  // Use double average as thresh-hold
  // This gives reasonable results so far ...
  function getPeaks(buffer) {
    let peaks = [];
    let avg = buffer[0] + buffer[buffer.length-1];

    // Get peaks that are notes and average peak
    for (let i = 1, max = buffer.length-1; i < max; i ++) {
      if (buffer[i-1] < buffer[i] && buffer[i] > buffer[i+1] && isNote[i])
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

    return peaks;
  }

  console.log(context);

  let i = 0; // REMOVE ME

  // This is called when we have a new FFT frame available
  processor.onaudioprocess = function(e) {
    // Do something with the data, e.g. convert it to WAV
    // const buff = e.inputBuffer; /* raw audio */
    // console.log(buff.getChannelData(0));
    fft.getByteFrequencyData(buffer);
    worker.postMessage(buffer);
    // if ((i++) % 1 === 0) { // REMOVE ME
    //   // console.log(buff);
    //   console.log(buffer);
    //   console.log(freqs);
    //   console.log(getPeaks(buffer).map(i => {
    //     return [noteName(notes[i]), notes[i], buffer[i]];
    //   }));
    // }
  };
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

getAudioStream();
