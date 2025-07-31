let audioContext;
let recorder;

function playTone(frequency, duration, delay = 0) {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(audioContext.currentTime + delay);
  oscillator.stop(audioContext.currentTime + delay + duration / 1000);
}

async function playTwoTone() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') await audioContext.resume();

  const freqA = parseFloat(document.getElementById('toneA').value);
  const durA = parseInt(document.getElementById('durationA').value);
  const freqB = parseFloat(document.getElementById('toneB').value);
  const durB = parseInt(document.getElementById('durationB').value);

  playTone(freqA, durA);
  setTimeout(() => {
    playTone(freqB, durB);
  }, durA + 250);
}

function savePreset() {
  const name = document.getElementById('presetName').value.trim();
  if (!name) return alert("Enter a preset name!");

  const preset = {
    aFreq: document.getElementById('toneA').value,
    aDur: document.getElementById('durationA').value,
    bFreq: document.getElementById('toneB').value,
    bDur: document.getElementById('durationB').value
  };

  localStorage.setItem(`tone_${name}`, JSON.stringify(preset));
  updatePresetList();
  alert("Preset saved!");
}

function loadPreset() {
  const selected = document.getElementById('savedPresets').value;
  if (!selected) return;
  const preset = JSON.parse(localStorage.getItem(`tone_${selected}`));
  if (preset) {
    document.getElementById('toneA').value = preset.aFreq;
    document.getElementById('durationA').value = preset.aDur;
    document.getElementById('toneB').value = preset.bFreq;
    document.getElementById('durationB').value = preset.bDur;
  }
}

function updatePresetList() {
  const select = document.getElementById('savedPresets');
  select.innerHTML = '<option value="">-- Select Saved Tone --</option>';
  for (let key in localStorage) {
    if (key.startsWith('tone_')) {
      const name = key.replace('tone_', '');
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
  }
}

window.onload = updatePresetList;

function downloadTone() {
  const freqA = parseFloat(document.getElementById('toneA').value);
  const durA = parseInt(document.getElementById('durationA').value);
  const freqB = parseFloat(document.getElementById('toneB').value);
  const durB = parseInt(document.getElementById('durationB').value);

  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const dest = audioContext.createMediaStreamDestination();
  const recorder = new MediaRecorder(dest.stream);
  const chunks = [];

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "TwoTone.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const oscillator1 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  oscillator1.type = 'sine';
  oscillator1.frequency.setValueAtTime(freqA, audioContext.currentTime);
  oscillator1.connect(gain1).connect(dest);
  oscillator1.start();
  oscillator1.stop(audioContext.currentTime + durA / 1000);

  setTimeout(() => {
    const oscillator2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(freqB, audioContext.currentTime);
    oscillator2.connect(gain2).connect(dest);
    oscillator2.start();
    oscillator2.stop(audioContext.currentTime + durB / 1000);
  }, durA + 250);

  recorder.start();
  setTimeout(() => recorder.stop(), durA + durB + 1000);
}

// Autocorrelation for tone detection
function autoCorrelate(buffer, sampleRate) {
  let SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Too quiet

  let r1 = 0, r2 = SIZE - 1, threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;

  let c = new Array(SIZE).fill(0);
  for (let lag = 0; lag < SIZE; lag++) {
    for (let i = 0; i < SIZE - lag; i++) {
      c[lag] += buffer[i] * buffer[i + lag];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxPos = d;
  let maxVal = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  let T0 = maxPos;
  let x1 = c[T0 - 1];
  let x2 = c[T0];
  let x3 = c[T0 + 1];
  let a = (x1 + x3 - 2 * x2) / 2;
  let b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

function analyzeAdvancedTone() {
  const fileInput = document.getElementById("toneFile");
  const resultDiv = document.getElementById("toneResult");
  resultDiv.innerHTML = "⏳ Analyzing...";

  if (!fileInput.files[0]) {
    resultDiv.innerHTML = "❌ Please upload a tone audio file.";
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  reader.onload = function (e) {
    audioCtx.decodeAudioData(e.target.result).then(buffer => {
      const sampleRate = buffer.sampleRate;
      const rawData = buffer.getChannelData(0);
      const duration = buffer.duration;
      const totalSamples = rawData.length;
      const type = duration > 3 ? "Long Tone" : "Two-Tone / Sort Tone";

      const toneSegmentSize = Math.floor(sampleRate * 0.5); // 0.5 second slice
      const toneAStart = Math.floor(sampleRate * 0.25);
      const toneBStart = Math.floor(sampleRate * 1.25); // 1s later

      const partA = rawData.slice(toneAStart, toneAStart + toneSegmentSize);
      const partB = rawData.slice(toneBStart, toneBStart + toneSegmentSize);

      setTimeout(() => {
        const freqA = autoCorrelate(partA, sampleRate);
        const freqB = autoCorrelate(partB, sampleRate);

        let aDisplay = freqA > 0 ? `${freqA.toFixed(2)} Hz` : "❌ Not Detected";
        let bDisplay = freqB > 0 ? `${freqB.toFixed(2)} Hz` : "❌ Not Detected";

        resultDiv.innerHTML = `
          ✅ Detected Mode: ${type}<br/>
          🎯 A Tone: <strong>${aDisplay}</strong><br/>
          🎯 B Tone: <strong>${bDisplay}</strong><br/>
          ⏱️ Duration: ${duration.toFixed(2)} seconds
        `;
      }, 50);
    }).catch(() => {
      resultDiv.innerHTML = "❌ Error decoding audio.";
    });
  };

  reader.readAsArrayBuffer(file);
}
