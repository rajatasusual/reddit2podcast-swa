export class ErrorDisplay {
  static displayError(error) {
    console.error('Application error:', error);
    const container = document.getElementById('episodes');
    if (container) {
      container.textContent = 'An error occurred while loading episodes. Please try again later.';
    }
  }
}
