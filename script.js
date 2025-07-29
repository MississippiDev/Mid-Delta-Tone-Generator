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

function playTwoTone() {
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