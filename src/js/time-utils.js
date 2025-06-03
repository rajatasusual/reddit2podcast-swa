export class TimeUtils {
  static formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  static convertAudioOffset(audioOffset) {
    return audioOffset / 10000000;
  }
}
