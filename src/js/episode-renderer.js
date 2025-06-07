export class EpisodeRenderer {
  static renderEpisodes(episodes, sasToken) {
    return episodes.map((episode, index) => {
      const transcriptSection = episode.transcriptsUrl ?
        this.renderTranscriptSection(index, episode.transcriptsUrl) : '';

      return `
  <div class="episode-wrapper">
    <div class="episode-card">
      <h2>${episode.title}</h2>
      <div class="meta">
        <a 
          href="?subreddit=${encodeURIComponent(episode.subreddit)}" 
          class="subreddit-tag"
          title="Show episodes from r/${episode.subreddit}"
        >
          r/${episode.subreddit}
        </a>
        &nbsp;|
         <i>${new Date(episode.createdOn).toDateString()}</i>
      </div>
      <div
        class="audio-player-container"
        data-audio-url="${episode.audioUrl}"
        data-sas="${sasToken}"
      >
        <p class="summary">${episode.summary}</p>
      </div>
    </div>
    ${transcriptSection} 
  </div>
`;

    }).join('');
  }

  static renderTranscriptSection(index, transcriptUrl) {
    return `
      <button class="transcript-toggle" 
        data-index="${index}"
        data-transcript-url="${transcriptUrl}">
        Show Transcript
      </button>
      <div class="transcript" id="transcript-${index}" style="display: none;"></div>
    `;
  }
}
