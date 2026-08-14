export function tocarSom() {
    try {
        const contextoAudio = new AudioContext();

        const oscilador = contextoAudio.createOscillator();
        const ganho = contextoAudio.createGain();

        oscilador.connect(ganho);
        ganho.connect(contextoAudio.destination);

        oscilador.frequency.value = 880;
        ganho.gain.value = 0.08;

        oscilador.start();

        oscilador.stop(
            contextoAudio.currentTime + 0.25
        );
    } catch (erro) {
        console.warn(erro);
    }
}