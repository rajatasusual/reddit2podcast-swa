// === ISSUES IDENTIFIED ===
// 1. `loadSSML`, `parseSSML`, `setupEventListeners`, `updateTranscriptSync`, and `cleanup` functions are defined outside the class but use `this` as if they are methods.
// 2. `this.init()` inside constructor is not `await`ed (which is fine), but `init` must be self-contained and context-aware.
// 3. Lazy loader only loads audio `src`, but doesn’t trigger the player init.
// 4. IntersectionObserver should trigger player load, not just src assignment.

// === FIXED VERSION ===

const STORAGEURL = 'https://reddit2podcast.blob.core.windows.net';
const FUNCTIONURL = 'https://reddit2podcast.azurewebsites.net';

const createAudioLazyLoader = () => {
  const observerOptions = {
    root: null,
    rootMargin: '100px 0px',
    threshold: 0.1
  };

  const lazyAudioObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target.querySelector('.audio-player-container');
        if (container && !container.dataset.initialized) {
          const audioUrl = container.dataset.audioUrl;
          const ssmlUrl = container.dataset.ssmlUrl;
          const sasToken = container.dataset.sasToken;
          new CustomAudioPlayer(container, audioUrl, ssmlUrl, sasToken);
          container.dataset.initialized = 'true';
        }
        lazyAudioObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  return lazyAudioObserver;
};

class CustomAudioPlayer {
  constructor(container, audioUrl, ssmlUrl, sasToken) {
    this.container = container;
    this.audioUrl = audioUrl;
    this.ssmlUrl = ssmlUrl;
    this.sasToken = sasToken;
    this.audio = null;
    this.ssmlData = null;
    this.currentTranscriptIndex = 0;
    this.isPlaying = false;

    this.init();
  }

  async init() {
    await this.loadSSML();
    this.createPlayerElements();
    this.setupEventListeners();
  }

  async loadSSML() {
    try {
      const response = await fetch(`${this.ssmlUrl}?${this.sasToken}`);
      const ssmlText = await response.text();
      this.ssmlData = this.parseSSML(ssmlText);
    } catch (error) {
      console.error('Failed to load SSML:', error);
    }
  }

  parseSSML(ssmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ssmlText, 'text/xml');
    const segments = [];

    const bookmarks = doc.querySelectorAll('bookmark');
    bookmarks.forEach((bookmark, index) => {
      const mark = bookmark.getAttribute('mark');
      const timestamp = parseFloat(mark.replace(/[^\d.]/g, '')) || 0;

      segments.push({
        timestamp,
        text: `Segment ${index + 1}`,
        element: null
      });
    });

    return segments.sort((a, b) => a.timestamp - b.timestamp);
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
        <div class="transcript-container">
          <div class="transcript-content"></div>
        </div>
      </div>
    `;

    this.audio = this.container.querySelector('audio');
    this.playPauseBtn = this.container.querySelector('.play-pause-btn');
    this.progressFill = this.container.querySelector('.progress-fill');
    this.timeDisplay = this.container.querySelector('.time-display');
    this.volumeSlider = this.container.querySelector('.volume-slider');
    this.transcriptContent = this.container.querySelector('.transcript-content');
  }

  setupEventListeners() {
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.audio.addEventListener('timeupdate', () => {
      this.updateProgress();
      this.updateTranscriptSync();
    });
    this.audio.addEventListener('loadedmetadata', () => {
      this.renderTranscript();
      this.updateTimeDisplay();
    });
    this.volumeSlider.addEventListener('input', (e) => {
      this.audio.volume = e.target.value / 100;
    });
  }

  togglePlayPause() {
    if (this.audio.paused) {
      this.audio.play();
      this.playPauseBtn.textContent = '⏸';
    } else {
      this.audio.pause();
      this.playPauseBtn.textContent = '▶';
    }
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

  updateTranscriptSync() {
    const currentTime = this.audio.currentTime;

    const activeSegment = this.ssmlData.find((segment, index) => {
      const next = this.ssmlData[index + 1];
      return currentTime >= segment.timestamp && (!next || currentTime < next.timestamp);
    });

    if (activeSegment && activeSegment.element) {
      this.transcriptContent.querySelectorAll('.active-segment')
        .forEach(el => el.classList.remove('active-segment'));

      activeSegment.element.classList.add('active-segment');
      activeSegment.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  renderTranscript() {
    this.transcriptContent.innerHTML = '';
    this.ssmlData.forEach(segment => {
      const el = document.createElement('div');
      el.className = 'transcript-segment';
      el.textContent = segment.text;
      segment.element = el;
      this.transcriptContent.appendChild(el);
    });
  }
}

window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const episode = urlParams.get('episode');

  async function getUserInfo() {
    const response = await fetch('/.auth/me');
    const payload = await response.json();
    const { clientPrincipal } = payload;
    return clientPrincipal;
  }

  const userInfo = await getUserInfo();

  const response = await fetch(`${FUNCTIONURL}/api/episodes${episode ? `?episode=${episode}` : ''}`, {
    body: JSON.stringify(userInfo),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const { episodes, sasToken } = await response.json();

  if (!episodes || !episodes.length) {
    document.body.innerText = 'No episodes found.';
    return;
  }

  const rssUrl = `${STORAGEURL}/reddit2podcast-public/rss/feed.xml`;
  document.body.innerHTML = `
    <h1>🎙️ Reddit2Podcast Episodes</h1>
    <p><a href="${rssUrl}" target="_blank">RSS Feed</a></p>
    ${episodes.map(ep => `
      <div class="episode-card">
        <h2>Episode – ${ep.date}</h2>
        <div class="meta">Subreddit: <strong>${ep.subreddit}</strong> | Created: ${ep.createdOn || 'N/A'}</div>
        <p class="summary">${ep.summary}</p>
        <div class="audio-player-container"
          data-audio-url="${ep.audioUrl}"
          data-ssml-url="${ep.ssmlUrl}"
          data-sas-token="${sasToken}">
          <div class="loading-placeholder">Loading...</div>
        </div>
        <div class="episode-links">
          <a href="${ep.jsonUrl}?${sasToken}" target="_blank">View JSON</a> |
          <a href="${ep.ssmlUrl}?${sasToken}" target="_blank">View SSML</a>
        </div>
      </div>`).join('')}`;

  const lazyLoader = createAudioLazyLoader();
  document.querySelectorAll('.episode-card').forEach(card => lazyLoader.observe(card));
});
