// Worker for analyzing time-series of Fourier spectra

console.log("Audio worker started");

const buffer = [];

// Collect spectra
onmessage = function({data}) {
  console.log(data);
};
