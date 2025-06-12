import { CONFIG } from './config.js';

export class ApiService {
  static async fetchUserAuth() {
    try {
      const response = await fetch('/.auth/me');
      if (!response.ok) {
        throw new Error('Authentication required');
      }
      const data = await response.json();
      if (!data.clientPrincipal) {
        throw new Error('No authenticated user found');
      }
      return data.clientPrincipal;
    } catch (error) {
      console.error('Failed to fetch user authentication:', error);
      // Redirect to login page
      window.location.href = '/login.html';
      return null;
    }
  }

  static async fetchEpisodes(subreddit = null) {
    try {
      const userAuth = await this.fetchUserAuth();
      const url = `${CONFIG.FUNCTION_URL}/api/episodes${subreddit ? `?subreddit=${subreddit}` : ''}`;
      const headers = { 'Content-Type': 'application/json' };
      const body = JSON.stringify(userAuth);
      const method = 'POST';

      return await fetchWithProgress({
        headers,
        body,
        url,
        method
      });
    } catch (error) {
      console.error('Failed to fetch episodes:', error);
      throw error;
    }
  }

  static async fetchTranscript(transcriptUrl, sasToken) {
    try {
      const response = await fetch(`${transcriptUrl}?${sasToken}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch transcript:', error);
      throw error;
    }
  }
}

async function fetchWithProgress(request) {
  const progressElement = document.getElementById('progress');
  progressElement.classList.add('indeterminate');
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  let loaded = 0;
  let total = null;

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    total = parseInt(contentLength, 10);
    progressElement.classList.remove('indeterminate');
  }
  
  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    if (total) {
      const percent = ((loaded / total) * 100).toFixed(2);
      progressElement.style.width = `${percent}%`;
    } else {
      const currentWidth = parseFloat(progressElement.style.width) || 0;
      const newWidth = Math.min(currentWidth + 2, 98);
      progressElement.style.width = `${newWidth}%`;
    }
  }

  progressElement.classList.remove('indeterminate');
  progressElement.style.width = '100%';

  // Combine chunks into a single Uint8Array
  let allChunks = new Uint8Array(loaded);
  let position = 0;
  for (let chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  // Decode to string and parse JSON
  const text = new TextDecoder("utf-8").decode(allChunks);
  return JSON.parse(text);
}

