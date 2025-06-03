import { CONFIG } from './config.js';

export class ApiService {
  static async fetchUserAuth() {
    try {
      const response = await fetch('/.auth/me');
      const data = await response.json();
      return data.clientPrincipal;
    } catch (error) {
      console.error('Failed to fetch user authentication:', error);
      return null;
    }
  }

  static async fetchEpisodes(episode = null) {
    try {
      const userAuth = await this.fetchUserAuth();
      const url = `${CONFIG.FUNCTION_URL}/api/episodes${episode ? `?episode=${episode}` : ''}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userAuth)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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
