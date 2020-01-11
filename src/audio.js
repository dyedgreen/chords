import { Chord } from "./chord.js";

// Audio analyzer. Records audio and returns
// analysis of results.
//
// Event handlers:
// onchord -> receives Chord objects found in audio
// onpower -> receives total power of audio slices
export class AudioAnalyzer {

  // Do not construct manually
  constructor(context, worker) {
    this._context = context;
    this._worker = worker;
    this._worker.onmessage = ({data}) => {
      // Silently drops messages if no handler is attached
      if (Array.isArray(data) && typeof this.onchord === "function") {
        this.onchord(new Chord(data));
      } else if (typeof this.onpower === "function") {
        this.onpower(data);
      }
    };
  }

  // Open a new AudioAnalyzer
  static async open() {
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
    const worker = new Worker("./worker/audio.js");
    worker.postMessage({
      hzPerBin,
      frequencyBinCount: fft.frequencyBinCount,
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

    return new AudioAnalyzer(context, worker);
  }

}
