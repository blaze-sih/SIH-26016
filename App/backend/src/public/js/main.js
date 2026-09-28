/**
 * LRVS — Client-side Enterprise Helper Functions
 * Team BLAZE | SIH26016
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Mobile sidebar toggle if needed
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  // Auto-dismiss alerts after 5 seconds
  const autoAlerts = document.querySelectorAll('.alert-autodismiss');
  autoAlerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });
});

/**
 * Copy text to clipboard with tooltip indication
 */
function copyToClipboard(text, elementId) {
  navigator.clipboard.writeText(text).then(() => {
    const el = document.getElementById(elementId);
    if (el) {
      const orig = el.innerText;
      el.innerText = 'Copied!';
      setTimeout(() => { el.innerText = orig; }, 2000);
    }
  });
}
