import { TimeUtils } from './time-utils.js';

export class TranscriptRenderer {
  constructor(transcriptDiv, audioPlayer) {
    this.transcriptDiv = transcriptDiv;
    this.audioPlayer = audioPlayer;
    this.transcript = null;
  }

  render(transcript) {
    this.transcript = transcript;
    this.transcriptDiv.innerHTML = '';
    
    transcript.forEach((entry, index) => {
      const span = this.createTranscriptSpan(entry, index);
      this.transcriptDiv.appendChild(span);
    });
  }

  createTranscriptSpan(entry, index) {
    const span = document.createElement('span');
    span.textContent = entry.text + ' ';
    span.classList.add('sentence');
    span.dataset.time = TimeUtils.convertAudioOffset(entry.audioOffset);
    span.dataset.index = index;
    
    span.addEventListener('click', () => {
      const time = parseFloat(span.dataset.time);
      this.audioPlayer.seekTo(time);
    });
    
    return span;
  }

  highlightCurrentText(currentTime) {
    if (!this.transcript) return;
    
    this.transcript.forEach((entry, index) => {
      const start = TimeUtils.convertAudioOffset(entry.audioOffset);
      const end = start + TimeUtils.convertAudioOffset(entry.duration || 0);
      const span = this.transcriptDiv.children[index];
      
      if (!span) return;
      
      if (currentTime >= start && currentTime <= end) {
        span.classList.add('active');
      } else {
        span.classList.remove('active');
      }
    });
  }

  isVisible() {
    return this.transcriptDiv.classList.contains('visible');
  }

  toggle() {
    this.transcriptDiv.classList.toggle('visible');
    return this.isVisible();
  }
}
