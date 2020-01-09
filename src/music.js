// TODO: Refactor this, these might be interesting later

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

// Build a chord object from a
// raw chord array (containing
// only the n representations of
// each note played)
function analyzeChord(raw) {
  let key = null;
  raw.sort((a, b) => a - b);
  // Get key
  if (raw.length === 3) {
    const a = raw[1] - raw[0],
          b = raw[2] - raw[1];
    if (a === 3 && b === 4) {
      key = "minor";
    } else if (a === 4 && b === 3) {
      key = "major";
    }
  }
  // Name the items. We use the following naming
  // strategy: maximize alphabetical distance
  // from lowest note.
  //
  // Name values: C -> 0, D -> 1, ..., B -> 6
  // Modifier values: -1 -> b (flat), 0 -> [none], +1 -> # (sharp)
  const names = [];
  const modifiers = [];
  const octaves = [];
  const map = [
    [[5, 0]], // A
    [[5, 1], [6, -1]], // #A or bB
    [[6, 0]], // B
    [[0, 0]], // C
    [[0, 1], [1, -1]], // #C or bD
    [[1, 0]], // D
    [[1, 1], [2, -1]], // #D or bE
    [[2, 0]], // E
    [[3, 0]], // F
    [[3, 1], [4, -1]], // #F or bG
    [[4, 0]], // G
    [[4, 1], [5, -1]], // #G or bA
  ];
  for (let i = 0; i < raw.length; i ++) {
    const n = raw[i];
    let pair = map[(120 + n) % 12];
    if (pair.length > 1) {
      pair = pair[i > 0 ? 1 : 0];
    } else {
      pair = pair[0];
    }

    names.push(pair[0]);
    modifiers.push(pair[1]);
    octaves.push((n >= 0 ? Math.floor((n-3) / 12) : Math.ceil((3-n) / 12)) + 3);
  }
  return {raw, key, names, modifiers, octaves};
}
