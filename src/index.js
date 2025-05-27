const STORAGEURL = 'https://reddit2podcast.blob.core.windows.net';
const FUNCTIONURL = 'https://reddit2podcast.azurewebsites.net';

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

  const firstEpisode = episodes[0];
  if (!firstEpisode) {
    document.body.innerText = 'No episodes found.';
  } else {
 
    const rssUrl = `${STORAGEURL}/reddit2podcast-public/rss/feed.xml`

    document.body.innerHTML = `
    <h1>🎙️ Reddit2Podcast Episodes</h1>
    <p><a href="${rssUrl}" target="_blank">RSS Feed</a></p>
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
  }
});
