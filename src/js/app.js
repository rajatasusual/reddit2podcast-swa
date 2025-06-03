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
  }

  async init() {
    try {
      await this.loadEpisodes();
      this.setupRSSLink();
      this.renderEpisodes();
      this.setupAudioPlayers();
      this.setupTranscriptToggles();
    } catch (error) {
      this.handleError(error);
    }
  }

  async loadEpisodes() {
    const urlParams = new URLSearchParams(window.location.search);
    const episode = urlParams.get('episode');
    
    const { episodes, sasToken } = await ApiService.fetchEpisodes(episode);
    this.episodes = episodes || [];
    this.sasToken = sasToken;
  }

  setupRSSLink() {
    const rssLink = document.getElementById('rss-link');
    if (rssLink) {
      rssLink.href = `${CONFIG.STORAGE_URL}${CONFIG.RSS_FEED_PATH}`;
    }
  }

  renderEpisodes() {
    const container = document.getElementById('episodes');
    
    if (!this.episodes.length) {
      container.textContent = 'No episodes found.';
      return;
    }
    
    container.innerHTML = EpisodeRenderer.renderEpisodes(this.episodes, this.sasToken);
  }

  setupAudioPlayers() {
    const playerContainers = document.querySelectorAll('.audio-player-container');
    
    playerContainers.forEach((container, index) => {
      const audioUrl = container.getAttribute('data-audio-url');
      const player = new AudioPlayer(container, audioUrl, this.sasToken);
      
      this.players.set(index, player);
      container._playerIndex = index;
    });
  }

  setupTranscriptToggles() {
    const transcriptButtons = document.querySelectorAll('.transcript-toggle');
    
    transcriptButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        this.handleTranscriptToggle(event.target);
      });
    });
  }

  async handleTranscriptToggle(button) {
    try {
      const index = parseInt(button.getAttribute('data-index'));
      const transcriptUrl = button.getAttribute('data-transcript-url');
      const transcriptDiv = document.getElementById(`transcript-${index}`);
      const player = this.players.get(index);
      
      if (!transcriptDiv.hasChildNodes()) {
        const transcriptData = await ApiService.fetchTranscript(transcriptUrl, this.sasToken);
        const transcriptRenderer = new TranscriptRenderer(transcriptDiv, player);
        transcriptRenderer.render(transcriptData);
        player.setTranscriptRenderer(transcriptRenderer);
      }
      
      const transcriptRenderer = player.transcriptRenderer;
      const isVisible = transcriptRenderer.toggle();
      button.textContent = isVisible ? 'Hide Transcript' : 'Show Transcript';
      
    } catch (error) {
      console.error('Error loading transcript:', error);
      button.textContent = 'Error loading transcript';
    }
  }

  handleError(error) {
    console.error('Application error:', error);
    const container = document.getElementById('episodes');
    container.textContent = 'An error occurred while loading episodes. Please try again later.';
  }
}

// Initialize the application when the DOM is loaded
window.addEventListener('load', () => {
  const app = new App();
  app.init();
});
