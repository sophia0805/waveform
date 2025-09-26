window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const button = document.getElementById('playBtn');
const recordBtn = document.getElementById('recordBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const colorPicker = document.getElementById('colorPicker');
const colorText = document.getElementById('colorText');
const fileName = document.getElementById('fileName');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const options = document.getElementById('options');
const wordCircleInput = document.getElementById('word-circle-input');
const wordCircle = document.getElementById('word-circle');
const clearWordsBtn = document.getElementById('clear-words');
canvas.width = window.innerWidth;
canvas.height = Math.floor(window.innerHeight * 0.9);
const data = new Uint8Array(analyser.frequencyBinCount);

let audioBuffer = null;
let playing = false;
let source = null;
let secondsPlayed = 0;
let recording = false;
let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let mostRecentId = 0;
const waveforms = [
    {
        angle: 0,
        color: 0,
        scale: 0,
        id: mostRecentId,
    }
]

let MAenergyValues = [];
let THRESHOLD = 0.4;
const MAX_WAVEFORMS = 1500;
const OUT_OF_BOUNDS_SCALE = 30;
let fastMode = false;
let c = 0;

analyser.fftSize = 2048;

async function decodeFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

async function startRecording() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micSource = audioContext.createMediaStreamSource(stream);
        micSource.connect(analyser);
        
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'audio/wav' });
            const arrayBuffer = await blob.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            fileName.textContent = 'Current File: Recording.wav';
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        };
        
        mediaRecorder.start();
        recording = true;
        recordBtn.textContent = 'Stop';
        recordBtn.classList.add('recording');
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && recording) {
        mediaRecorder.stop();
        recording = false;
        recordBtn.textContent = 'Record';
        recordBtn.classList.remove('recording');
    }
}

(async () => {
    try {
        audioBuffer = await audioContext.decodeAudioData(await fetch('sample.mp3').then(res => res.arrayBuffer()));
        analyser.connect(audioContext.destination);
        fileName.textContent = 'Current File: default.mp3';
        console.log('Audio loaded successfully');
    } catch (error) {
        console.error('Failed to load audio:', error);
    }
})();

function draw() {
	if (options.value === 'option1') {
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		// our analyser will put frequency info into our data aray
		analyser.getByteFrequencyData(data)
		ctx.strokeStyle = colorPicker.value;
		ctx.beginPath();
		ctx.moveTo(0, canvas.height);
		for (let i = 0; i < data.length; i++) {
			// data[i] is the amplitude height
			// we normalize it like below:
			const value = data[i] / 256
			const y = canvas.height - canvas.height * value
			ctx.lineTo(i, y);
		}
	} else if (options.value === 'option2') {
		ctx.save();

		analyser.getByteTimeDomainData(data);
	
		let energy = 0;
		for (let i = 0; i < data.length; i++) {
			const sample = (data[i] - 128) / 128; // normalize
			energy += sample * sample; //rms
		}
		const rms = Math.sqrt(energy / data.length);
	
		MAenergyValues.push(rms);
		if (MAenergyValues.length > 20) {
			MAenergyValues.shift();
		}
	
		const averageRMS = MAenergyValues.reduce((a, b) => a + b, 0) / MAenergyValues.length;
	
		if (!fastMode && rms > 0.6) {
			fastMode = true;
			setTimeout(() => { fastMode = false }, 1250);
		}
	
		if (rms > THRESHOLD && waveforms.length < MAX_WAVEFORMS) {
			waveforms.push({
				angle: 0,
				color: fastMode ? c : Math.random() * 360,
				scale: 1,
				id: ++mostRecentId,
			});
		}
		if (playing && waveforms.length === 0) {
			waveforms.push({ angle: 0, color: c, scale: 1, id: ++mostRecentId });
		}
	
		if (waveforms.length > MAX_WAVEFORMS) { console.log("reached max waveforms") }
	
		for (const waveform of waveforms) {
			ctx.save();
	
			const speed = 2;
			ctx.translate(canvas.width / 2, canvas.height / 2);
			ctx.rotate(waveform.angle + averageRMS * speed / 4);
	
			const scale = mostRecentId == waveform.id ? 1 : waveform.scale;
			ctx.scale(scale + averageRMS * speed, scale + averageRMS * speed);
	
			ctx.fillStyle = mostRecentId == waveform.id ?
				colorPicker.value :
				`hsl(${waveform.color * 2}, 100%, 70%)`;
	
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = "100px Audiowide";
			ctx.fillText(wordCircleInput.value, 0, 0);
	
			if (playing) {
				waveform.angle += fastMode ? 0.025 : 0.01;
				waveform.scale += fastMode ? 0.05 : 0.01;
				waveform.color += fastMode ? 0.1 : 0.05;
            }
			if (waveform.scale > OUT_OF_BOUNDS_SCALE && waveforms.length > 1) {
				waveforms.splice(waveforms.indexOf(waveform), 1);
			}
	
			if (fastMode && waveform.angle > Math.PI * 4 && waveforms.length > 1) {
				console.log("removed waveform in fast mode");
				waveforms.splice(waveforms.indexOf(waveform), 1);
			}
	
			ctx.restore();
		}
		ctx.restore();
		c++;
	}
	requestAnimationFrame(draw);
	ctx.stroke();
}

button.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (audioContext.state === 'suspended'){
		audioContext.resume();
	}
    const duration = audioBuffer ? audioBuffer.duration : 0;
    if (playing) {
        if (source && typeof source._startedAt === 'number') {
            secondsPlayed += (audioContext.currentTime - source._startedAt);
        }
        if (duration > 0) {
            secondsPlayed = Math.min(Math.max(secondsPlayed, 0), duration);
        }
        source.stop();
        playing = false;
        button.innerHTML = 'Play';
    } else {
        if (duration > 0) {
            secondsPlayed = Math.min(Math.max(secondsPlayed, 0), duration);
        }
        source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        source._startedAt = audioContext.currentTime;
        source.start(0, secondsPlayed);
        playing = true;
        button.innerHTML = 'Pause';
        source.onended = () => {
            if (!playing) return; // ignore manual pause
            playing = false;
            secondsPlayed = 0;
            button.innerHTML = 'Play';
        };
    }
    draw();
});

recordBtn.addEventListener('click', () => {
    if (recording) {
        stopRecording();
    } else {
        startRecording();
    }
});

fileInput.addEventListener('change', async (e) => {
    try { if (source) source.stop(); } catch(_) {}
	playing = false;
    button.innerHTML = 'Play';
    secondsPlayed = 0;
    audioBuffer = await decodeFromFile(e.target.files && e.target.files[0]);
	fileName.textContent = 'Current File: ' + e.target.files[0].name;
    draw();
    console.log(audioBuffer);
});

if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
        if (colorText) colorText.textContent = e.target.value;
    });
}

options.addEventListener('change', (e) => {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (wordCircle) {
        if (e.target.value === 'option2') {
            wordCircle.classList.add('show');
        } else {
            wordCircle.classList.remove('show');
        }
    }
    draw();
});

wordCircleInput.addEventListener('input', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw();
});

if (clearWordsBtn) {
    clearWordsBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        waveforms.length = 0;
        mostRecentId = 0;
        draw();
    });
}