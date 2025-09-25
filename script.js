window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const button = document.getElementById('playBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const colorPicker = document.getElementById('colorPicker');
const colorText = document.getElementById('colorText');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = Math.floor(window.innerHeight * 0.8);
const data = new Uint8Array(analyser.frequencyBinCount);

let audioBuffer = null;
let playing = false;
let source = null;
let secondsPlayed = 0; // single offset tracker in seconds

analyser.fftSize = 2048;

async function decodeFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

(async () => {
    try {
        audioBuffer = await audioContext.decodeAudioData(await fetch('sample.mp3').then(res => res.arrayBuffer()));
        analyser.connect(audioContext.destination);
        console.log('Audio loaded successfully');
    } catch (error) {
        console.error('Failed to load audio:', error);
    }
})();

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	// our analyser will put frequency info into our data aray
	analyser.getByteFrequencyData(data)
	ctx.strokeStyle = colorPicker.value;
	ctx.beginPath();
	ctx.moveTo(0, canvas.height);
	for (let i = 0; i < data.length; i++) {
		// data[i] is the amplitude height
		// we normalize it like below:
		const value = data[i] / 1024
		const y = canvas.height - canvas.height * value
		ctx.lineTo(i, y);
	}
	ctx.stroke();
	requestAnimationFrame(draw);
}

button.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    if (playing) {
        secondsPlayed += (audioContext.currentTime - source._startedAt);
        source.stop();
        playing = false;
        button.innerHTML = 'Play';
    } else {
        source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        source._startedAt = audioContext.currentTime;
        source.start(0, secondsPlayed);
        playing = true;
        button.innerHTML = 'Pause';
        source.onended = () => {
            playing = false;
            secondsPlayed = 0;
            button.innerHTML = 'Play';
        };
    }
    draw();
});

fileInput.addEventListener('change', async (e) => {
    if (source) {
		source.stop();
	}
	playing = false;
    button.innerHTML = 'Play';
    secondsPlayed = 0;
    audioBuffer = await decodeFromFile(e.target.files && e.target.files[0]);
    draw();
    console.log(audioBuffer);
});

// Update waveform color when color picker changes
if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
        if (colorText) colorText.textContent = e.target.value;
        draw(); // Redraw with new color
    });
}