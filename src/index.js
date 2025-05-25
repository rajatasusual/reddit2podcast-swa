window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const episode = urlParams.get('episode');
  if (!episode) return;

  const principal = request.headers.get('x-ms-client-principal');
  if (!principal) {
    return {
      status: 401,
      body: 'Unauthorized'
    };
  }
  const response = await fetch(`https://reddit2podcast.azurewebsites.net/api/episodes?episode=${episode}`, {
    headers: {
      'x-ms-client-principal': principal
    }
  });
  const {episodes, sasToken} = await response.json();

  document.body.innerHTML = `
    <h1>🎙️ Reddit2Podcast Episodes</h1>
    <h2>Episode - ${episodes[0].date}</h1>
    ${episodes.map(ep => `
      <div class="episode-card">
        <h2>Episode – ${ep.date}</h2>
        <div class="meta">Subreddit: <strong>${ep.subreddit}</strong> | Created: ${ep.createdOn || 'N/A'}</div>
        <p class="summary">${ep.summary}</p>
        <audio controls src="${ep.audioUrl}?${sasToken}"></audio><br />
        <a href="${ep.jsonUrl}?${sasToken}" target="_blank">View JSON</a> |
        <a href="${ep.ssmlUrl}?${sasToken}" target="_blank">View SSML</a>
      </div>
    `).join('')}
  `;
});
