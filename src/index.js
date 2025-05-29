const STORAGEURL = 'https://reddit2podcast.blob.core.windows.net';
const FUNCTIONURL = 'https://reddit2podcast.azurewebsites.net';
let currentAudioPlayer = null;

class CustomAudioPlayer {
  constructor(container, audioUrl, ssmlUrl, sasToken) {
    this.container = container;
    this.audioUrl = audioUrl;
    this.ssmlUrl = ssmlUrl;
    this.sasToken = sasToken;
    this.audio = null;

    this.init();
  }

  init() {
    this.createPlayerElements();
    this.setupEventListeners();
  }

  createPlayerElements() {
    this.container.innerHTML = `
      <div class="custom-audio-player">
        <audio preload="metadata" src="${this.audioUrl}?${this.sasToken}"></audio>
        <div class="player-controls">
          <button class="play-pause-btn">▶</button>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <span class="time-display">0:00 / 0:00</span>
          </div>
          <div class="volume-control">
            <input type="range" class="volume-slider" min="0" max="100" value="100">
          </div>
        </div>
      </div>
    `;

    this.audio = this.container.querySelector('audio');
    this.playPauseBtn = this.container.querySelector('.play-pause-btn');
    this.progressFill = this.container.querySelector('.progress-fill');
    this.timeDisplay = this.container.querySelector('.time-display');
    this.volumeSlider = this.container.querySelector('.volume-slider');
  }

  setupEventListeners() {
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
    this.volumeSlider.addEventListener('input', (e) => {
      this.audio.volume = e.target.value / 100;
    });
  }

  togglePlayPause() {
    if (currentAudioPlayer && currentAudioPlayer !== this) {
      currentAudioPlayer.pauseAudio();
    }

    if (this.audio.paused) {
      this.audio.play();
      this.playPauseBtn.textContent = '⏸';
      this.container.querySelector('.custom-audio-player').classList.add('fixed-bottom');
      currentAudioPlayer = this;
    } else {
      this.audio.pause();
      this.playPauseBtn.textContent = '▶';
      this.container.querySelector('.custom-audio-player').classList.remove('fixed-bottom');
      currentAudioPlayer = null;
    }
  }

  pauseAudio() {
    this.audio.pause();
    this.playPauseBtn.textContent = '▶';
    this.container.querySelector('.custom-audio-player').classList.remove('fixed-bottom');
  }

  updateProgress() {
    if (!this.audio.duration) return;
    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressFill.style.width = `${percent}%`;
    this.updateTimeDisplay();
  }

  updateTimeDisplay() {
    const format = (t) => {
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
    };
    this.timeDisplay.textContent = `${format(this.audio.currentTime)} / ${format(this.audio.duration)}`;
  }
}

const createAudioLazyLoader = () => {
  const observerOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
  };

  const lazyAudioObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        if (!container.dataset.initialized) {
          const audioUrl = container.dataset.audioUrl;
          const ssmlUrl = container.dataset.ssmlUrl;
          const sasToken = container.dataset.sasToken;
          new CustomAudioPlayer(container, audioUrl, ssmlUrl, sasToken);
          container.dataset.initialized = 'true';
        }
        lazyAudioObserver.unobserve(container);
      }
    });
  }, observerOptions);

  return lazyAudioObserver;
};

window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const episode = urlParams.get('episode');

  async function getUserInfo() {
    const response = await fetch('/.auth/me');
    const payload = await response.json();
    return payload.clientPrincipal;
  }

  const userInfo = await getUserInfo();
  const response = await fetch(`${FUNCTIONURL}/api/episodes${episode ? `?episode=${episode}` : ''}`, {
    body: JSON.stringify(userInfo),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const { episodes, sasToken } = await response.json();

  if (!episodes || !episodes.length) {
    document.getElementById('episodes').innerText = 'No episodes found.';
    return;
  }

  document.getElementById('rss-link').href = `${STORAGEURL}/reddit2podcast-public/rss/feed.xml`;

  const container = document.getElementById('episodes');
  container.innerHTML = episodes.map(ep => `
    <div class="episode-card">
      <h2>Episode – ${ep.date}</h2>
      <div class="meta">Subreddit: <strong>${ep.subreddit}</strong> | Created: ${ep.createdOn || 'N/A'}</div>
      <p class="summary">${ep.summary}</p>
      <div class="audio-player-container"
        data-audio-url="${ep.audioUrl}"
        data-ssml-url="${ep.ssmlUrl}"
        data-sas-token="${sasToken}">
        <div class="loading-placeholder">Loading player...</div>
      </div>
    </div>`).join('');

  const lazyLoader = createAudioLazyLoader();
  document.querySelectorAll('.audio-player-container').forEach(container => {
    lazyLoader.observe(container);
  });
});
