const STORAGEURL = 'https://reddit2podcast.blob.core.windows.net';
const FUNCTIONURL = 'https://reddit2podcast.azurewebsites.net';

class CustomAudioPlayer {
  static current = null;

  constructor(container, audioUrl, sasToken) {
    this.container = container;
    this.audioUrl = audioUrl;
    this.sasToken = sasToken;
    this.audio = null;
    this.transcript = null;
    this.transcriptDiv = null;

    this.build();
  }

  build() {
    // inject controls
    this.container.innerHTML = `
          <div class="player-controls">
            <button class="play-pause-btn"></button>
            <span class="time start-time">00:00</span>
            <input type="range" min="0" step="0.25" value="0" class="seek">
            <span class="time end-time">00:00</span>
          </div>
          <p class="summary">${this.container.querySelector('.summary').innerHTML}</p>
        `;
    // create audio element
    this.audio = document.createElement('audio');
    this.audio.src = this.audioUrl + '?' + this.sasToken;
    this.audio.preload = 'metadata';
    this.container.prepend(this.audio);

    // grab elements
    this.playBtn = this.container.querySelector('.play-pause-btn');
    this.seek = this.container.querySelector('.seek');
    this.startTime = this.container.querySelector('.start-time');
    this.endTime = this.container.querySelector('.end-time');

    // bind events
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.setupSeek());
    this.seek.addEventListener('input', () => this.onSeek());
    this.audio.addEventListener('ended', () => this.onEnded());
  }

  setTranscript(transcript, transcriptDiv) {
    this.transcript = transcript;
    this.transcriptDiv = transcriptDiv;
  }

  togglePlay() {
    if (this.audio.paused) {
      if (CustomAudioPlayer.current)
        CustomAudioPlayer.current.togglePlay();
      this.audio.play();
      CustomAudioPlayer.current = this;
    } else {
      this.audio.pause();
      CustomAudioPlayer.current = null;
    }
    this.playBtn.classList.toggle('paused', !this.audio.paused);
  }

  setupSeek() {
    this.seek.max = this.audio.duration;
    this.endTime.textContent = this.formatTime(this.audio.duration);
  }

  updateProgress() {
    this.seek.value = this.audio.currentTime;
    this.startTime.textContent = this.formatTime(this.audio.currentTime);

    if (this.transcript && this.transcriptDiv) {
      const currentTime = this.audio.currentTime;
      for (let i = 0; i < this.transcript.length; i++) {
        const entry = this.transcript[i];
        const start = entry.audioOffset / 10000000;
        const end = start + (entry.duration || 0) / 10000000;
        const span = this.transcriptDiv.children[i];
        if (!span) continue;
        if (currentTime >= start && currentTime <= end) {
          span.classList.add('active');
        } else {
          span.classList.remove('active');
        }
      }
    }

  }

  onSeek() {
    this.audio.currentTime = this.seek.value;
    this.updateProgress();
  }

  onEnded() {
    this.playBtn.classList.remove('paused');
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}

function renderTranscript(transcript, transcriptDiv, audio, player) {
  transcriptDiv.innerHTML = '';
  transcript.forEach((entry, index) => {
    const span = document.createElement('span');
    span.textContent = entry.text + ' ';
    span.classList.add('sentence');
    span.dataset.time = entry.audioOffset / 10000000;
    span.dataset.index = index;
    span.onclick = () => {
      audio.currentTime = parseFloat(span.dataset.time);
      if (!audio.paused)
        audio.play();
    };
    transcriptDiv.appendChild(span);
  });

  if (player && typeof player.setTranscript === 'function') {
    player.setTranscript(transcript, transcriptDiv);
  }
}

window.addEventListener('load', async () => {
  // fetch episodes
  const urlParams = new URLSearchParams(window.location.search);
  const episode = urlParams.get('episode');
  const resp = await fetch(`${FUNCTIONURL}/api/episodes${episode ? `?episode=${episode}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await fetch('/.auth/me').then(r => r.json()).then(j => j.clientPrincipal))
  });
  const { episodes, sasToken } = await resp.json();
  const container = document.getElementById('episodes');

  document.getElementById('rss-link').href = `${STORAGEURL}/reddit2podcast-public/rss/feed.xml`;

  if (!episodes?.length) {
    container.innerText = 'No episodes found.';
    return;
  }
  container.innerHTML = episodes.map((ep, i) => `
  <hr>
  <div class="episode-card">
    <h2>${ep.date}</h2>
    <div class="meta">
      Subreddit: <i>${ep.subreddit}</i> |
      Created: ${new Date(ep.createdOn).toDateString()}
    </div>
    <div class="audio-player-container" 
         data-audio-url="${ep.audioUrl}" 
         data-sas="${sasToken}">
      <p class="summary">${ep.summary}</p>
    </div>
    ${ep.transcriptsUrl ? `
      <button class="transcript-toggle" 
        data-index="${i}"
        data-transcript-url="${ep.transcriptsUrl}">
        Show Transcript</button>
      <div class="transcript" id="transcript-${i}" style="display: none;"></div>
    ` : ''}
  </div>
`).join('');

  document.querySelectorAll('.audio-player-container').forEach(async el => {
    const audioUrl = el.getAttribute('data-audio-url');
    const player = new CustomAudioPlayer(el, audioUrl, sasToken);
    el._player = player;

  });

  document.querySelectorAll('.transcript-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = btn.getAttribute('data-index');
      const transcriptUrl = btn.getAttribute('data-transcript-url');
      const resp = await fetch(transcriptUrl + '?' + sasToken);
      const transcriptJson = await resp.json();
      const transcriptDiv = document.getElementById(`transcript-${index}`);

      const audioContainer = document.querySelectorAll('.audio-player-container')[index];
      const player = audioContainer._player;
      renderTranscript(transcriptJson, transcriptDiv, player.audio, player);

      transcriptDiv.classList.toggle('visible');
      btn.textContent = transcriptDiv.classList.contains('visible') ? 'Hide Transcript' : 'Show Transcript';

    });
  });

});