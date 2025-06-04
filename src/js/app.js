import { CONFIG } from './config.js';
import { ApiService } from './api-service.js';
import { AudioPlayer } from './audio-player.js';
import { TranscriptRenderer } from './transcript-renderer.js';
import { EpisodeRenderer } from './episode-renderer.js';

class App {
  constructor() {
    this.episodes = [];
    this.sasToken = '';
    this.players = new Map();
    this.currentEpisode = null;
    this.ticking = false;
  }

  async init() {
    try {
      await this.loadEpisodes();
      this.setRSSLink();
      this.renderEpisodes();
      this.initAudioPlayers();
      this.initTranscriptToggles();
      window.addEventListener('scroll', this.throttledStickyHandler.bind(this));
    } catch (error) {
      this.displayError(error);
    }
  }

  async loadEpisodes() {
    const urlParams = new URLSearchParams(window.location.search);
    const episode = urlParams.get('episode');
    const { episodes = [], sasToken } = await ApiService.fetchEpisodes(episode);
    this.episodes = episodes;
    this.sasToken = sasToken;
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
      ? EpisodeRenderer.renderEpisodes(this.episodes, this.sasToken)
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
      this.toggleSummary(this.currentEpisode, true);
    }

    episodeWrapper.classList.add('current-episode');
    this.toggleSummary(episodeWrapper, false);
    this.currentEpisode = episodeWrapper;
    episodeWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleSummary(wrapper, show) {
    const summary = wrapper.querySelector('.summary');
    if (summary) summary.style.display = show ? 'block' : 'none';
  }

  throttledStickyHandler() {
    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        this.updateStickyPosition();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  updateStickyPosition() {
        if (!this.currentEpisode) return;

    const rect = this.currentEpisode.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollBottom = scrollTop + viewportHeight;
    const pageHeight = document.documentElement.scrollHeight;

    const alreadyTop = this.currentEpisode.classList.contains('sticky-top');
    const alreadyBottom = this.currentEpisode.classList.contains('sticky-bottom');

    // Case: Scrolled past — stick to top
    if (rect.top <= 0 && scrollBottom < pageHeight - 1) {
      if (!alreadyTop) {
        this.currentEpisode.classList.remove('sticky-bottom');
        this.currentEpisode.classList.add('sticky-top');
      }
    }
    // Case: Before it's in view — stick to bottom
    else if (rect.bottom >= viewportHeight && scrollTop > 0) {
      if (!alreadyBottom) {
        this.currentEpisode.classList.remove('sticky-top');
        this.currentEpisode.classList.add('sticky-bottom');
      }
    }
  }

  initTranscriptToggles() {
    document.querySelectorAll('.transcript-toggle').forEach(btn =>
      btn.addEventListener('click', () => this.handleTranscriptToggle(btn))
    );
  }

  async handleTranscriptToggle(button) {
    try {
      const index = Number(button.dataset.index);

      const currentEpisodeIndex = this.currentEpisode?.querySelector('.transcript-toggle')?.dataset.index;
      const isCurrent = currentEpisodeIndex && index === Number(currentEpisodeIndex);
      const transcriptUrl = button.dataset.transcriptUrl;
      const transcriptDiv = document.getElementById(`transcript-${index}`);
      const player = this.players.get(index);

      if (!transcriptDiv.hasChildNodes()) {
        const data = await ApiService.fetchTranscript(transcriptUrl, this.sasToken);
        const renderer = new TranscriptRenderer(transcriptDiv, player);
        renderer.render(data);
        player.setTranscriptRenderer(renderer);
      }

      const isVisible = player.transcriptRenderer.toggle();
      button.textContent = isVisible ? 'Hide Transcript' : 'Show Transcript';
      document.body.style.overflow = isCurrent && isVisible ? 'hidden' : 'auto';
    } catch (error) {
      console.error('Error loading transcript:', error);
      button.textContent = 'Error loading transcript';
    }
  }

  displayError(error) {
    console.error('Application error:', error);
    const container = document.getElementById('episodes');
    if (container) {
      container.textContent = 'An error occurred while loading episodes. Please try again later.';
    }
  }
}

// App initialization
window.addEventListener('load', () => new App().init());
