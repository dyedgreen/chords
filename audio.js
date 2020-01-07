// Try to get raw audio bytes
async function getAudioStream() {
  const worker = new Worker("./audio_worker.js");

  const bufferSize = 4096; // smallest 2^N which has decent resolution ...
  const timeStep   = 100 - 1; // in ms

  // Create audio pipeline
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context      = new AudioContext();
  const stream       = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
  const source       = context.createMediaStreamSource(stream);
  const fft          = context.createAnalyser();
  const processor    = context.createScriptProcessor(bufferSize, 1, 1);

  // FFT settings
  fft.fftSize = bufferSize;
  fft.smoothingTimeConstant = 0.1; // TODO: Adjust ... (still)
  fft.minDecibels = -70; // think it's good; this is a fine line to walk though ...

  // Connect audio nodes
  source.connect(fft);
  fft.connect(processor);
  processor.connect(context.destination);

  // Buffer for fft results
  const buffer = new Uint8Array(fft.frequencyBinCount);
  const hzPerBin = (context.sampleRate) / (2*fft.frequencyBinCount);

  // Send settings to worker
  worker.postMessage({
    timeStep,
    hzPerBin,
    frequencyBinCount: buffer.length,
  });

  // This is called when we have a new FFT frame available
  let next = performance.now() - 1;
  processor.onaudioprocess = function(e) {
    fft.getByteFrequencyData(buffer);
    if (performance.now() > next) {
      worker.postMessage(buffer);
      next = performance.now() + timeStep;
    }
  };
}

getAudioStream();
