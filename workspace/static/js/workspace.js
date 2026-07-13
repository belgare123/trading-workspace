/* ═══════════════════════════════════════════════════════════════════════════
   Workspace Platform — Core JavaScript
   ═══════════════════════════════════════════════════════════════════════════ */

// WebSocket connection
class WsClient {
  constructor(path, onMessage) {
    this.ws = null;
    this.path = path;
    this.onMessage = onMessage;
    this.reconnectDelay = 1000;
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}${this.path}`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.reconnectDelay = 1000; };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (this.onMessage) this.onMessage(data);
      } catch (err) {
        console.warn('WS parse error:', err);
      }
    };
    this.ws.onclose = () => {
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
        this.connect();
      }, this.reconnectDelay);
    };
    this.ws.onerror = () => this.ws.close();
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// Format helpers
const fmt = {
  price(v) { return v != null ? v.toFixed(2) : '—'; },
  pct(v) { return v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '—'; },
  num(v) { return v != null ? v.toLocaleString() : '—'; },
  time(ts) { return new Date(ts * 1000).toLocaleTimeString(); },
  stars(rating) {
    const n = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 }[rating] || 0;
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  },
  elapsed(ts) {
    const sec = Math.floor((Date.now() / 1000 - ts));
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    return Math.floor(sec / 3600) + 'h ago';
  },
  direction(dir) {
    if (dir === 'LONG' || dir === 'BUY') return '<span class="tag long">LONG</span>';
    return '<span class="tag short">SHORT</span>';
  },
  statusDot(status) {
    const cls = { 'OK': 'online', 'WARN': 'warning', 'ERROR': 'offline' }[status] || 'offline';
    return `<span class="status-dot ${cls}"></span>`;
  }
};

// Live-update helper
function liveText(el, getValue) {
  if (!el) return;
  const update = () => {
    const v = getValue();
    if (v !== undefined) el.textContent = v;
  };
  update();
  setInterval(update, 2000);
}

// Tab navigation
function navigateTo(route) {
  window.location.href = route;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const key = e.key;
  if (key >= '0' && key <= '9') {
    const appId = ['settings', 'scanner', 'opportunities', 'strategies',
                    'replay', 'inspector', 'learning', 'plugins', 'monitor', 'api'][parseInt(key)];
    if (appId) {
      const link = document.querySelector(`.ws-nav-item[data-app="${appId}"]`);
      if (link) {
        e.preventDefault();
        window.location.href = link.getAttribute('href');
      }
    }
  }
});
