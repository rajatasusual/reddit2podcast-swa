import { ApiService } from './api-service.js';
import { TranscriptRenderer } from './transcript-renderer.js';

export class TranscriptManager {
  constructor(app) {
    this.app = app;
  }

  initTranscriptToggles() {
    document.querySelectorAll('.transcript-toggle').forEach(btn =>
      btn.addEventListener('click', () => this.handleTranscriptToggle(btn))
    );
  }

  async handleTranscriptToggle(button) {
    try {
      const index = Number(button.dataset.index);

      const transcriptUrl = button.dataset.transcriptUrl;
      const transcriptDiv = document.getElementById(`transcript-${index}`);
      const player = this.app.players.get(index);

      if (!transcriptDiv.hasChildNodes()) {
        const data = await ApiService.fetchTranscript(transcriptUrl, this.app.sasToken);
        const renderer = new TranscriptRenderer(transcriptDiv, player);
        renderer.render(data);
        player.setTranscriptRenderer(renderer);
      }

      const isVisible = player.transcriptRenderer.toggle();
      button.textContent = isVisible ? 'Hide Transcript' : 'Show Transcript';

      this.bodyScrollHandler();

    } catch (error) {
      console.error('Error loading transcript:', error);
      button.textContent = 'Error loading transcript';
    }
  }

  async bodyScrollHandler() {
    //disable body overflow if current episode has transcript visible
    const currentEpisode = this.app.currentEpisode;
    if (currentEpisode) {
      const transcriptDiv = currentEpisode.querySelector('.transcript');
      if (transcriptDiv && transcriptDiv.classList.contains('visible')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    }
  }
}
