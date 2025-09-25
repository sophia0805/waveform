window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const button = document.getElementById('button');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const data = new Uint8Array(analyser.frequencyBinCount);

let audioBuffer = null;
let playing = false;
let source = null;

analyser.fftSize = 2048;

const decodeAudio = async (url) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
};

// Load the audio buffer
(async () => {
    try {
        audioBuffer = await decodeAudio('sample.mp3');
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
	ctx.strokeStyle = `black`
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
	button.innerHTML = playing ? 'Play' : 'Pause';
	if (playing) {
		source.stop();
		playing = false;
	} else {
		source = audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(analyser);
		source.start();
		playing = true;
	}
	draw();
});