"""
Workspace Platform — Main entry point.

FastAPI application serving the Workspace UI.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader

from core import __version__
from workspace.core.app_registry import get_app, get_apps, get_apps_by_category

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

_jinja = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=True,
)


def _render(name: str, **ctx: Any) -> str:
    tmpl = _jinja.get_template(name)
    return tmpl.render(**ctx)


# WebSocket connection manager
class WSManager:
    def __init__(self) -> None:
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)

    async def broadcast(self, data: dict[str, Any]) -> None:
        msg = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._clients)


ws_manager = WSManager()


def create_app() -> FastAPI:
    """Create and configure the Workspace FastAPI application."""
    app = FastAPI(
        title="Trading Workspace",
        version=__version__,
        description="Workspace Platform — Phase 14",
    )

    # Static files
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

    # ── Workspace Shell ────────────────────────────────────────────

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def workspace_shell(request: Request):
        """Workspace shell — redirect to first app."""
        apps = get_apps()
        default = apps[0].route if apps else "/scanner"
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="scanner",
            app_name="Scanner",
            content=f'<script>window.location.href="{default}";</script>',
        )

    @app.get("/apps", response_class=JSONResponse)
    async def list_apps():
        return JSONResponse([a.to_dict() for a in get_apps()])

    # ── App Pages ──────────────────────────────────────────────────

    def _app_page(app_id: str, title: str, extra_head: str = "") -> str:
        app = get_app(app_id)
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app=app_id,
            app_name=title,
            content=f'<div class="app-container" id="app-{app_id}">'
                    f'<div class="app-header"><h1>{app.icon} {title}</h1>'
                    f'<p>{app.description}</p></div>'
                    f'<div id="{app_id}-content"></div></div>',
            extra_head=extra_head,
        )

    @app.get("/scanner", response_class=HTMLResponse, include_in_schema=False)
    async def scanner_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="scanner",
            app_name="Scanner",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🔍 Scanner</h1>
                <p>Live signal stream from all strategies</p>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Signal Flow</span>
                  <span style="color:var(--text-muted);font-size:12px">
                    <span class="status-dot online"></span> Listening
                  </span>
                </div>
                <div id="signal-stream" class="signal-stream">
                  <div style="color:var(--text-muted);text-align:center;padding:40px">
                    Waiting for signals...
                  </div>
                </div>
              </div>
            </div>
            <script>
              const stream = document.getElementById('signal-stream');
              new WsClient('/ws/scanner', (data) => {
                if (data.type === 'signal') {
                  const line = document.createElement('div');
                  line.className = 'signal-line';
                  line.innerHTML = `
                    <span class="symbol">${data.symbol}</span>
                    <span class="strategy">${data.strategy}</span>
                    <span class="score" style="color:${data.score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)'}">${data.score}</span>
                    <span class="direction">${fmt.direction(data.direction)}</span>
                    <span class="stars">${fmt.stars(data.rating)}</span>
                    <span style="color:var(--text-muted);font-size:11px">${fmt.time(data.timestamp)}</span>
                  `;
                  stream.insertBefore(line, stream.firstChild);
                  while (stream.children.length > 200) stream.removeChild(stream.lastChild);
                }
              });
            </script>
            """,
        )

    @app.get("/opportunities", response_class=HTMLResponse, include_in_schema=False)
    async def opportunities_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="opportunities",
            app_name="Opportunities",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🎯 Opportunity Center</h1>
                <p>Active, pending and closed trading opportunities</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">Active</div>
                  <div class="metric-value green" id="opp-active">0</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Pending</div>
                  <div class="metric-value blue" id="opp-pending">0</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Today P&L</div>
                  <div class="metric-value" id="opp-pnl">+0.00%</div>
                </div>
              </div>
              <div id="opp-list"></div>
            </div>
            <script>
              const oppList = document.getElementById('opp-list');
              oppList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">Loading opportunities...</div>';
              new WsClient('/ws/opportunities', (data) => {
                if (data.type === 'opportunity') {
                  const pnl = data.pnl != null ? (data.pnl >= 0 ? '+' : '') + data.pnl.toFixed(2) + '%' : '—';
                  const statusClass = data.status === 'active' ? 'active' : data.status === 'waiting' ? 'waiting' : 'stopped';
                  const card = document.createElement('div');
                  card.className = 'opp-card';
                  card.innerHTML = `
                    <span class="opp-symbol">${data.symbol}</span>
                    <span class="opp-direction">${fmt.direction(data.direction)}</span>
                    <span class="opp-status ${statusClass}">${data.status}</span>
                    <span class="opp-pnl" style="color:${data.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${pnl}</span>
                    <span class="opp-meta">RR ${data.rr || '—'} · ${fmt.elapsed(data.timestamp)}</span>
                  `;
                  oppList.insertBefore(card, oppList.firstChild);
                }
                if (data.type === 'metrics') {
                  document.getElementById('opp-active').textContent = data.active || 0;
                  document.getElementById('opp-pending').textContent = data.pending || 0;
                  document.getElementById('opp-pnl').textContent = (data.pnl >= 0 ? '+' : '') + (data.pnl || 0).toFixed(2) + '%';
                }
              });
            </script>
            """,
        )

    @app.get("/strategies", response_class=HTMLResponse, include_in_schema=False)
    async def strategies_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="strategies",
            app_name="Strategies",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🧠 Strategy Center</h1>
                <p>Strategy management: health, metrics, lifecycle controls</p>
              </div>
              <div id="strategy-list"></div>
            </div>
            <script>
              const sl = document.getElementById('strategy-list');
              sl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">Loading strategies...</div>';
              new WsClient('/ws/strategies', (data) => {
                if (data.type === 'strategy_status') {
                  const healthDot = fmt.statusDot(data.health);
                  const card = document.createElement('div');
                  card.className = 'card';
                  card.innerHTML = `
                    <div class="card-header">
                      <span class="card-title">${healthDot} ${data.name}</span>
                      <div style="display:flex;gap:4px">
                        <button class="btn btn-sm" onclick="alert('Config')">⚙️</button>
                        <button class="btn btn-sm btn-danger" onclick="alert('Pause')">⏸</button>
                        <button class="btn btn-sm" onclick="alert('Restart')">🔄</button>
                      </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
                      <div><div style="color:var(--text-muted)">Winrate</div><div style="font-family:var(--font-mono)">${data.winrate || '—'}%</div></div>
                      <div><div style="color:var(--text-muted)">PF</div><div style="font-family:var(--font-mono)">${data.profit_factor || '—'}</div></div>
                      <div><div style="color:var(--text-muted)">Last Signal</div><div style="font-family:var(--font-mono)">${data.last_signal ? fmt.elapsed(data.last_signal) : '—'}</div></div>
                      <div><div style="color:var(--text-muted)">CPU</div><div style="font-family:var(--font-mono)">${data.cpu || '0'}%</div></div>
                      <div><div style="color:var(--text-muted)">Memory</div><div style="font-family:var(--font-mono)">${data.memory || '0'} MB</div></div>
                    </div>
                  `;
                  sl.innerHTML = '';
                  sl.appendChild(card);
                }
              });
            </script>
            """,
        )

    @app.get("/replay", response_class=HTMLResponse, include_in_schema=False)
    async def replay_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="replay",
            app_name="Replay Studio",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>▶️ Replay Studio</h1>
                <p>Deterministic backtest IDE with breakpoints</p>
              </div>
              <div style="display:grid;grid-template-columns:1fr 300px;gap:16px">
                <div class="card">
                  <div class="card-header">
                    <span class="card-title">Timeline</span>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-sm">⏮</button>
                      <button class="btn btn-sm btn-primary">▶</button>
                      <button class="btn btn-sm">⏭</button>
                      <span style="color:var(--text-muted);font-size:12px;margin-left:8px">1x</span>
                    </div>
                  </div>
                  <div style="height:300px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
                    Timeline control — coming soon
                  </div>
                </div>
                <div class="card">
                  <div class="card-header">
                    <span class="card-title">Inspector</span>
                  </div>
                  <div style="color:var(--text-muted);font-size:12px">
                    <div>EMA: —</div>
                    <div>RSI: —</div>
                    <div>ATR: —</div>
                    <div>Decision: —</div>
                  </div>
                </div>
              </div>
            </div>
            """,
        )

    @app.get("/inspector", response_class=HTMLResponse, include_in_schema=False)
    async def inspector_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="inspector",
            app_name="Inspector",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🔬 Feature Inspector</h1>
                <p>Understand why decisions were made — per-symbol feature analysis</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <input id="inspector-symbol" value="BTCUSDT"
                       style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px 12px;border-radius:4px;font-family:var(--font-mono)">
                <button class="btn btn-primary" onclick="inspectSymbol()">Inspect</button>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Features</span>
                  <span style="color:var(--text-muted);font-size:12px">Last update: —</span>
                </div>
                <div id="feature-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
                  <div style="color:var(--text-muted);text-align:center;padding:20px">Select symbol to inspect</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Decision Chain</span>
                </div>
                <div id="decision-chain" style="color:var(--text-muted);font-family:var(--font-mono);font-size:12px"></div>
              </div>
            </div>
            <script>
              function inspectSymbol() {
                const sym = document.getElementById('inspector-symbol').value || 'BTCUSDT';
                fetch('/api/v1/inspector/' + sym)
                  .then(r => r.json())
                  .then(data => {
                    const grid = document.getElementById('feature-grid');
                    grid.innerHTML = '';
                    for (const [key, val] of Object.entries(data.features || {})) {
                      const v = typeof val === 'number' ? val.toFixed(4) : val;
                      grid.innerHTML += `<div class="metric-card"><div class="metric-label">${key}</div><div class="metric-value" style="font-size:16px">${v}</div></div>`;
                    }
                    const dc = document.getElementById('decision-chain');
                    dc.innerHTML = (data.decision_chain || []).map(d => '<div>→ ' + d + '</div>').join('');
                  })
                  .catch(err => {
                    document.getElementById('feature-grid').innerHTML =
                      '<div style="color:var(--accent-red);text-align:center;padding:20px">Error: ' + err + '</div>';
                  });
              }
              inspectSymbol();
            </script>
            """,
        )

    @app.get("/learning", response_class=HTMLResponse, include_in_schema=False)
    async def learning_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="learning",
            app_name="Learning",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🤖 Learning Center</h1>
                <p>ML model hub: accuracy, retrain, predictions</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">Regime Classifier</div>
                  <div class="metric-value green">91%</div>
                  <div class="metric-change up">Accuracy ↑ 2.1%</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Performance Predictor</div>
                  <div class="metric-value blue">R² 0.73</div>
                  <div class="metric-change up">Precision ↑ 0.04</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Anomaly Detector</div>
                  <div class="metric-value orange">87%</div>
                  <div class="metric-change up">Precision ↑ 1.2%</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Models</span>
                  <button class="btn btn-primary btn-sm" onclick="alert('Retraining...')">🔄 Retrain All</button>
                </div>
                <table class="data-table">
                  <tr><th>Model</th><th>Status</th><th>Score</th><th>Samples</th><th>Version</th><th></th></tr>
                  <tr><td>Regime Classifier</td><td><span class="status-dot online"></span> Ready</td><td>0.91</td><td>12,430</td><td>1.2.0</td><td><button class="btn btn-sm" onclick="alert('Retrain regime classifier')">Retrain</button></td></tr>
                  <tr><td>Performance Predictor</td><td><span class="status-dot online"></span> Ready</td><td>0.73</td><td>8,210</td><td>1.1.0</td><td><button class="btn btn-sm" onclick="alert('Retrain performance predictor')">Retrain</button></td></tr>
                  <tr><td>Anomaly Detector</td><td><span class="status-dot online"></span> Ready</td><td>0.87</td><td>45,600</td><td>2.0.0</td><td><button class="btn btn-sm" onclick="alert('Retrain anomaly detector')">Retrain</button></td></tr>
                </table>
              </div>
            </div>
            """,
        )

    @app.get("/plugins", response_class=HTMLResponse, include_in_schema=False)
    async def plugins_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="plugins",
            app_name="Plugin Store",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🧩 Plugin Store</h1>
                <p>Browse, install and manage plugins</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn-sm btn-primary">Trending</button>
                  <button class="btn btn-sm">Signals</button>
                  <button class="btn btn-sm">Indicators</button>
                  <button class="btn btn-sm">Exchanges</button>
                  <button class="btn btn-sm">Analysis</button>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
                <div class="card">
                  <div class="card-header"><span class="card-title">Momentum Pro</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Advanced momentum detection with volume confirmation</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag long">Signal</span>
                    <span class="tag bull">Momentum</span>
                  </div>
                  <button class="btn btn-primary btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">ICT Concepts</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Smart Money, Order Blocks, FVG, Liquidity</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag bull">Analysis</span>
                    <span class="tag neutral">ICT</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">Whale Tracker</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Large order flow and whale wallet monitoring</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag neutral">Data</span>
                    <span class="tag long">Whales</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">News Sentiment</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Real-time news + sentiment analysis for any symbol</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag neutral">News</span>
                    <span class="tag bull">AI</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
              </div>
            </div>
            """,
        )

    @app.get("/monitor", response_class=HTMLResponse, include_in_schema=False)
    async def monitor_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="monitor",
            app_name="System",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>📊 System Monitor</h1>
                <p>Runtime: services, CPU, RAM, latency</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">CPU</div>
                  <div class="metric-value" id="sys-cpu">—</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Memory</div>
                  <div class="metric-value" id="sys-mem">—</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Active Plugins</div>
                  <div class="metric-value blue" id="sys-plugins">32</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">WS Clients</div>
                  <div class="metric-value" id="sys-ws">0</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Services</span></div>
                <table class="data-table" id="service-table">
                  <tr><th>Service</th><th>Status</th><th>Uptime</th><th>Latency</th></tr>
                </table>
              </div>
            </div>
            <script>
              fetch('/api/v1/system/status').then(r=>r.json()).then(data => {
                document.getElementById('sys-cpu').textContent = data.cpu_percent + '%';
                document.getElementById('sys-mem').textContent = data.memory_mb + ' MB';
                document.getElementById('sys-plugins').textContent = data.active_plugins;
                document.getElementById('sys-ws').textContent = data.ws_clients;
                const st = document.getElementById('service-table');
                for (const [name, status] of Object.entries(data.services || {})) {
                  st.innerHTML += `<tr><td>${name}</td><td>${fmt.statusDot(status)} ${status}</td><td>—</td><td>—</td></tr>`;
                }
              });
            </script>
            """,
        )

    @app.get("/api", response_class=HTMLResponse, include_in_schema=False)
    async def api_explorer_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="api",
            app_name="API Explorer",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>📡 API Explorer</h1>
                <p>Live API reference — test endpoints, inspect responses</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <select id="api-method" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px;border-radius:4px">
                  <option>GET</option>
                  <option>POST</option>
                </select>
                <input id="api-path" value="/api/v1/system/status"
                       style="flex:1;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px 12px;border-radius:4px;font-family:var(--font-mono)">
                <button class="btn btn-primary" onclick="callAPI()">Send</button>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Response</span></div>
                <pre id="api-response" style="color:var(--accent-green);font-family:var(--font-mono);font-size:12px;white-space:pre-wrap">Click "Send" to call an endpoint</pre>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Available Endpoints</span></div>
                <table class="data-table">
                  <tr><th>Method</th><th>Path</th><th>Description</th></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/api/v1/system/status</td><td>Runtime status</td></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/api/v1/inspector/{symbol}</td><td>Feature inspector</td></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/apps</td><td>List workspace apps</td></tr>
                </table>
              </div>
            </div>
            <script>
              async function callAPI() {
                const method = document.getElementById('api-method').value;
                const path = document.getElementById('api-path').value;
                const resp = document.getElementById('api-response');
                resp.textContent = 'Loading...';
                try {
                  const r = await fetch(path, { method });
                  const text = await r.text();
                  try { resp.textContent = JSON.stringify(JSON.parse(text), null, 2); }
                  catch { resp.textContent = text; }
                } catch(err) {
                  resp.textContent = 'Error: ' + err;
                }
              }
            </script>
            """,
        )

    @app.get("/settings", response_class=HTMLResponse, include_in_schema=False)
    async def settings_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="settings",
            app_name="Settings",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>⚙️ Settings</h1>
                <p>Platform configuration</p>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">General</span></div>
                <div style="display:grid;gap:12px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Workspace Theme</span>
                    <select style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px">
                      <option>Dark</option>
                      <option>Light</option>
                    </select>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Default Symbol</span>
                    <input value="BTCUSDT" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px;width:120px">
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Auto-refresh (sec)</span>
                    <input type="number" value="5" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px;width:80px">
                  </div>
                </div>
              </div>
            </div>
            """,
        )

    # ── API Endpoints ──────────────────────────────────────────────

    @app.get("/api/v1/system/status")
    async def system_status():
        return {
            "services": {
                "Feature Engine": "OK",
                "Decision Engine": "OK",
                "Replay": "OK",
                "Learning": "OK",
                "Telegram": "OK",
            },
            "cpu_percent": 12.4,
            "memory_mb": 186,
            "active_plugins": 32,
            "active_strategies": 8,
            "uptime_hours": 47.3,
            "ws_clients": ws_manager.count,
        }

    @app.get("/api/v1/inspector/{symbol:str}")
    async def feature_inspector(symbol: str):
        return {
            "symbol": symbol,
            "features": {
                "EMA-20": 65321.45,
                "RSI-14": 62.3,
                "ATR-14": 712.8,
                "Trend": "Bull",
                "Volatility": "Expansion",
                "Whales": "Active",
                "Confidence": "78%",
                "Volume Ratio": 1.42,
                "Spread": 0.0003,
                "Liquidity": "High",
            },
            "decision_chain": [
                f"Trend analysis: BULL (EMA>200, +3.2%)",
                "RSI: 62.3 (bullish, no divergence)",
                "Volume: 1.42x avg (confirms trend)",
                "Volatility: Expansion (ATR ratio 1.62)",
                "Decision: LONG with 78% confidence",
            ],
        }

    # ── WebSocket ──────────────────────────────────────────────────

    @app.websocket("/ws/scanner")
    async def ws_scanner(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)

    @app.websocket("/ws/opportunities")
    async def ws_opportunities(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)

    @app.websocket("/ws/strategies")
    async def ws_strategies(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)

    return app


app = create_app()
