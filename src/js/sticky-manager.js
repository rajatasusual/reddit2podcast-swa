export class StickyManager {
  constructor(app) {
    this.app = app;
    this.ticking = false;
    this.throttledStickyHandler = this.throttledStickyHandler.bind(this);
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
    const currentEpisode = this.app.currentEpisode;
    if (!currentEpisode) return;

    const rect = currentEpisode.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollBottom = scrollTop + viewportHeight;
    const pageHeight = document.documentElement.scrollHeight;

    const alreadyTop = currentEpisode.classList.contains('sticky-top');
    const alreadyBottom = currentEpisode.classList.contains('sticky-bottom');

    if (rect.top <= 0 && scrollBottom < pageHeight - 1) {
      if (!alreadyTop) {
        currentEpisode.classList.remove('sticky-bottom');
        currentEpisode.classList.add('sticky-top');
      }
    } else if (rect.bottom >= viewportHeight && scrollTop > 0) {
      if (!alreadyBottom) {
        currentEpisode.classList.remove('sticky-top');
        currentEpisode.classList.add('sticky-bottom');
      }
    }
  }
}
