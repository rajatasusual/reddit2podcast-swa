import { CONFIG } from './config.js';
import { ApiService } from './api-service.js';
import { AudioPlayer } from './audio-player.js';
import { EpisodeRenderer } from './episode-renderer.js';
import { StickyManager } from './sticky-manager.js';
import { TranscriptManager } from './transcript-manager.js';
import { ErrorDisplay } from './error-display.js';

export class App {
  constructor() {
    this.subreddit = null;
    this.episodes = [];
    this.sasToken = '';
    this.players = new Map();
    this.currentEpisode = null;
    this.stickyManager = new StickyManager(this);
    this.transcriptManager = new TranscriptManager(this);
  }

  async init() {
    try {
      await this.loadEpisodes();
      this.setRSSLink();
      this.renderEpisodes();
      this.initAudioPlayers();
      this.transcriptManager.initTranscriptToggles();
      window.addEventListener('scroll', this.stickyManager.throttledStickyHandler);
    } catch (error) {
      ErrorDisplay.displayError(error);
    }
  }

  showSubreddit(subreddit) {
    const subredditDisplay = document.getElementById('subreddit-display');
    subredditDisplay.innerHTML = `
      <span class="subreddit-name">r/${subreddit}</span>
    `;

    subredditDisplay.style.display = 'block';
    setTimeout(() => {
      subredditDisplay.classList.add('visible');
    }, 10);
  }

  async loadEpisodes() {
    const urlParams = new URLSearchParams(window.location.search);
    const subreddit = urlParams.get('subreddit');

    if (subreddit) {
      this.showSubreddit(subreddit);
    }

    const { episodes = [], sasToken } = await ApiService.fetchEpisodes(subreddit);
    this.episodes = episodes;
    this.sasToken = sasToken;
    this.subreddit = subreddit;
  }

  setRSSLink() {
    const rssLink = document.getElementById('rss-link');
    if (rssLink) {
      rssLink.href = `${CONFIG.STORAGE_URL}${CONFIG.RSS_FEED_PATH}`;
    }
  }

  renderEpisodes() {
    const container = document.getElementById('episodes');
    if (!container) return;

    container.innerHTML = this.episodes.length
      ? EpisodeRenderer.renderEpisodes(this.episodes, this.sasToken, this.subreddit)
      : 'No episodes found.';
  }

  initAudioPlayers() {
    document.querySelectorAll('.audio-player-container').forEach((container, index) => {
      const audioUrl = container.dataset.audioUrl;
      const player = new AudioPlayer(container, audioUrl, this.sasToken);

      player.audio.addEventListener('play', () => {
        this.highlightEpisode(container.closest('.episode-wrapper'));
      });

      this.players.set(index, player);
      container._playerIndex = index;
    });
  }

  highlightEpisode(episodeWrapper) {
    if (!episodeWrapper) return;

    if (this.currentEpisode) {
      this.currentEpisode.classList.remove('current-episode');
      this.toggleCurrentPlayer(this.currentEpisode, true);
    }

    episodeWrapper.classList.add('current-episode');
    this.toggleCurrentPlayer(episodeWrapper, false);
    this.currentEpisode = episodeWrapper;
    episodeWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

    this.transcriptManager.bodyScrollHandler();
  }

  toggleCurrentPlayer(wrapper, show) {
    const summary = wrapper.querySelector('.summary');
    if (summary) summary.style.display = show ? 'block' : 'none';
    const meta = wrapper.querySelector('.meta');
    if (meta) meta.style.display = show ? 'flex' : 'none';
  }
}

// App initialization
window.addEventListener('load', () => new App().init());
