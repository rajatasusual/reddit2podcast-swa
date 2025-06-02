const STORAGEURL = 'https://reddit2podcast.blob.core.windows.net';
const FUNCTIONURL = 'https://reddit2podcast.azurewebsites.net';

class CustomAudioPlayer {
  static current = null;

  constructor(container, audioUrl, sasToken) {
    this.container = container;
    this.audioUrl = audioUrl;
    this.sasToken = sasToken;
    this.audio = null;
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
  }

  onSeek() {
    this.audio.currentTime = this.seek.value;
    this.updateProgress();
  }

  onEnded() {
    this.playBtn.classList.remove('pause');
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}

function renderTranscript(transcript, transcriptDiv, audio) {
  transcriptDiv.innerHTML = '';
  transcript.forEach((entry, index) => {
    const span = document.createElement('span');
    span.textContent = entry.text + ' ';
    span.classList.add('sentence');
    span.dataset.time = entry.audioOffset / 10000000;
    span.dataset.index = index;
    span.onclick = () => {
      audio.currentTime = parseFloat(span.dataset.time);
      audio.play();
    };
    transcriptDiv.appendChild(span);
  });
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
      <button class="transcript-toggle" data-index="${i}" data-sas="${sasToken}">Show Transcript</button>
      <div class="transcript" id="transcript-${i}" style="display: none;"></div>
    ` : ''}
  </div>
`).join('');

  document.querySelectorAll('.audio-player-container').forEach(el => {
    new CustomAudioPlayer(
      el,
      el.getAttribute('data-audio-url'),
      el.getAttribute('data-sas')
    );
  });

  document.querySelectorAll('.transcript-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = btn.dataset.index;
      const sasToken = btn.dataset.sas;
      const transcriptDiv = document.getElementById(`transcript-${index}`);
      const ep = episodes[index];

      if (transcriptDiv.innerHTML === '') {
        const res = await fetch(ep.transcriptsUrl + '?' + sasToken);
        const transcriptJson = await res.json();
        renderTranscript(transcriptJson, transcriptDiv, document.querySelectorAll('.audio-player-container')[index].querySelector('audio'));
      }

      const isVisible = transcriptDiv.style.display === 'block';
      transcriptDiv.style.display = isVisible ? 'none' : 'block';
      btn.textContent = isVisible ? 'Show Transcript' : 'Hide Transcript';
    });
  });

});