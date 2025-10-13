export const monitorMicStream = (stream: MediaStream, onVolume: (volume: number) => void) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    function update() {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        onVolume(volume);
        requestAnimationFrame(update);
    }

    update();
}

export const monitorInboundMediaStream = (stream: MediaStream, onVolume: (volume: number) => void) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        onVolume(avg); // Use this for animation
        requestAnimationFrame(update);
    };

    update();
}