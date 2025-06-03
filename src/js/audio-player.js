import { TimeUtils } from './time-utils.js';

export class AudioPlayer {
  static currentPlayer = null;

  constructor(container, audioUrl, sasToken) {
    this.container = container;
    this.audioUrl = audioUrl;
    this.sasToken = sasToken;
    this.audio = null;
    this.elements = {};
    this.transcript = null;
    this.transcriptRenderer = null;
    
    this.init();
  }

  init() {
    this.createPlayerHTML();
    this.createAudioElement();
    this.cacheElements();
    this.bindEvents();
  }

  createPlayerHTML() {
    const summaryContent = this.container.querySelector('.summary')?.innerHTML || '';
    this.container.innerHTML = `
      <div class="player-controls">
        <button class="play-pause-btn" aria-label="Play/Pause"></button>
        <span class="time start-time">00:00</span>
        <input type="range" min="0" step="0.25" value="0" class="seek" aria-label="Seek">
        <span class="time end-time">00:00</span>
      </div>
      <p class="summary">${summaryContent}</p>
    `;
  }

  createAudioElement() {
    this.audio = document.createElement('audio');
    this.audio.src = `${this.audioUrl}?${this.sasToken}`;
    this.audio.preload = 'metadata';
    this.container.prepend(this.audio);
  }

  cacheElements() {
    this.elements = {
      playBtn: this.container.querySelector('.play-pause-btn'),
      seek: this.container.querySelector('.seek'),
      startTime: this.container.querySelector('.start-time'),
      endTime: this.container.querySelector('.end-time')
    };
  }

  bindEvents() {
    this.elements.playBtn.addEventListener('click', () => this.togglePlay());
    this.elements.seek.addEventListener('input', () => this.onSeek());
    
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.setupSeek());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('pause', () => this.onPause());
    this.audio.addEventListener('play', () => this.onPlay());
  }

  setTranscriptRenderer(transcriptRenderer) {
    this.transcriptRenderer = transcriptRenderer;
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  play() {
    if (AudioPlayer.currentPlayer && AudioPlayer.currentPlayer !== this) {
      AudioPlayer.currentPlayer.pause();
    }
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  setupSeek() {
    this.elements.seek.max = this.audio.duration;
    this.elements.endTime.textContent = TimeUtils.formatTime(this.audio.duration);
  }

  updateProgress() {
    this.elements.seek.value = this.audio.currentTime;
    this.elements.startTime.textContent = TimeUtils.formatTime(this.audio.currentTime);
    
    if (this.transcriptRenderer) {
      this.transcriptRenderer.highlightCurrentText(this.audio.currentTime);
    }
  }

  onSeek() {
    this.audio.currentTime = this.elements.seek.value;
  }

  onEnded() {
    this.elements.playBtn.classList.remove('paused');
    if (AudioPlayer.currentPlayer === this) {
      AudioPlayer.currentPlayer = null;
    }
  }

  onPause() {
    this.elements.playBtn.classList.remove('paused');
    if (AudioPlayer.currentPlayer === this) {
      AudioPlayer.currentPlayer = null;
    }
  }

  onPlay() {
    this.elements.playBtn.classList.add('paused');
    AudioPlayer.currentPlayer = this;
  }

  seekTo(time) {
    this.audio.currentTime = time;
    if (this.audio.paused) {
      this.play();
    }
  }
}
