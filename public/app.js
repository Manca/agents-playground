// ── STATE ──
let provider = 'openai';
let checks = 0;
let calcs = 0;
let startTime = Date.now();
let weatherSpinInterval = null;
let acIndex = -1;
let acDebounce = null;

const spinners = ['◐', '◓', '◑', '◒'];
let spinIdx = 0;

// ── ELEMENTS ──
const cityInput      = document.getElementById('city-input');
const cityDropdown   = document.getElementById('city-dropdown');
const weatherBtn     = document.getElementById('weather-btn');
const weatherStatus  = document.getElementById('weather-status');
const weatherLatest  = document.getElementById('weather-latest');
const weatherLog     = document.getElementById('weather-log');
const calcInput      = document.getElementById('calc-input');
const calcOutput     = document.getElementById('calc-output');
const calcBtn        = document.getElementById('calc-btn');
const calcHistory    = document.getElementById('calc-history');
const calcHistoryWrap = document.getElementById('calc-history-wrap');
const headerClock    = document.getElementById('header-clock');
const footerClock    = document.getElementById('footer-clock');
const uptimeEl       = document.getElementById('uptime');
const checkCountEl   = document.getElementById('check-count');
const calcCountEl    = document.getElementById('calc-count');
const panelHeaderTag = document.querySelector('.panel-header-tag');

// ── CLOCK ──
function tick() {
  const t = new Date().toTimeString().slice(0, 8);
  headerClock.textContent = t;
  footerClock.textContent = t;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  uptimeEl.textContent = `${h}:${m}:${s}`;
}

setInterval(tick, 1000);
tick();

// ── PROVIDER ──
function setProvider(p) {
  provider = p;
  document.getElementById('btn-openai').classList.toggle('active', p === 'openai');
  document.getElementById('btn-anthropic').classList.toggle('active', p === 'anthropic');
}

document.getElementById('btn-openai').addEventListener('click', () => setProvider('openai'));
document.getElementById('btn-anthropic').addEventListener('click', () => setProvider('anthropic'));

// ── WEATHER ──
function setWeatherLoading(loading) {
  if (loading) {
    weatherBtn.disabled = true;
    clearInterval(weatherSpinInterval);
    weatherSpinInterval = setInterval(() => {
      weatherBtn.textContent = `${spinners[spinIdx++ % 4]} FETCHING...`;
    }, 140);
  } else {
    clearInterval(weatherSpinInterval);
    weatherBtn.disabled = false;
    weatherBtn.textContent = '◈ FETCH NOW';
  }
}

async function loadWeatherHistory() {
  try {
    const res = await fetch('/api/weather/history');
    const { lines } = await res.json();

    if (!lines.length) {
      weatherLog.innerHTML = '<div class="log-empty">NO DATA — RUN A WEATHER CHECK</div>';
      weatherLatest.textContent = '—';
      return;
    }

    weatherLatest.textContent = lines[0];
    weatherLog.innerHTML = lines
      .map((line, i) => `<div class="log-entry${i === 0 ? ' latest' : ''}" style="animation-delay:${i * 40}ms">${escHtml(line)}</div>`)
      .join('');
  } catch {
    weatherStatus.textContent = 'LOAD ERR';
  }
}

async function fetchWeather() {
  const city = cityInput.value.trim() || 'Burlingame, CA';
  panelHeaderTag.textContent = city.toUpperCase();
  setWeatherLoading(true);
  weatherStatus.textContent = '';
  weatherStatus.style.color = '';

  try {
    const res = await fetch('/api/weather/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    });
    const data = await res.json();
    checks++;
    checkCountEl.textContent = checks;

    if (data.ok) {
      weatherStatus.textContent = '✓ SAVED';
      await loadWeatherHistory();
    } else {
      weatherStatus.textContent = '✗ ' + (data.error ?? 'ERR');
      weatherStatus.style.color = 'var(--red-bright)';
    }
  } catch {
    weatherStatus.textContent = '✗ NETWORK ERR';
    weatherStatus.style.color = 'var(--red-bright)';
  } finally {
    setWeatherLoading(false);
    setTimeout(() => {
      weatherStatus.textContent = '';
      weatherStatus.style.color = '';
    }, 4000);
  }
}

weatherBtn.addEventListener('click', fetchWeather);
loadWeatherHistory();
setInterval(loadWeatherHistory, 15000);

// ── CALCULATOR ──
async function runCalc() {
  const question = calcInput.value.trim();
  if (!question) return;

  calcBtn.disabled = true;
  calcOutput.className = 'output-box loading';
  calcOutput.textContent = 'PROCESSING';

  let spinI = 0;
  const loadInterval = setInterval(() => {
    calcOutput.textContent = 'PROCESSING' + '.'.repeat((spinI++ % 3) + 1);
  }, 400);

  try {
    const res = await fetch('/api/calculator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, provider }),
    });
    const data = await res.json();
    clearInterval(loadInterval);

    if (data.answer) {
      calcOutput.className = 'output-box';
      await typewriter(calcOutput, data.answer);
      calcs++;
      calcCountEl.textContent = calcs;
      addToHistory(question, data.answer);
      calcInput.value = '';
    } else {
      calcOutput.className = 'output-box error';
      calcOutput.textContent = '✗ ' + (data.error ?? 'UNKNOWN ERROR');
    }
  } catch {
    clearInterval(loadInterval);
    calcOutput.className = 'output-box error';
    calcOutput.textContent = '✗ NETWORK ERROR';
  } finally {
    calcBtn.disabled = false;
  }
}

function addToHistory(q, a) {
  calcHistoryWrap.style.display = 'block';
  const entry = document.createElement('div');
  entry.className = 'calc-entry';
  entry.innerHTML = `<div class="q">&gt; ${escHtml(q)}</div><div class="a">${escHtml(a)}</div>`;
  calcHistory.prepend(entry);
  while (calcHistory.children.length > 8) calcHistory.lastChild.remove();
}

calcBtn.addEventListener('click', runCalc);
calcInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runCalc();
  }
});

// ── AUTOCOMPLETE ──
cityInput.addEventListener('input', () => {
  const q = cityInput.value.trim();
  clearTimeout(acDebounce);
  if (q.length < 2) { closeDropdown(); return; }
  showDropdownLoading();
  acDebounce = setTimeout(() => fetchCities(q), 300);
});

cityInput.addEventListener('keydown', (e) => {
  const items = cityDropdown.querySelectorAll('.ac-item');
  if (cityDropdown.classList.contains('open')) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acIndex = Math.min(acIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acIndex = Math.max(acIndex - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acIndex >= 0 && items[acIndex]) {
        selectCity(items[acIndex].dataset.city);
      } else {
        closeDropdown();
        fetchWeather();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  } else if (e.key === 'Enter') {
    fetchWeather();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrap')) closeDropdown();
});

async function fetchCities(q) {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&layer=city&lang=en`;
    const res = await fetch(url);
    const data = await res.json();

    const seen = new Set();
    const cities = data.features
      .filter(f => f.properties.osm_key === 'place')
      .map(f => {
        const p = f.properties;
        return p.countrycode === 'US' && p.state
          ? `${p.name}, ${p.state}`
          : p.country ? `${p.name}, ${p.country}` : p.name;
      })
      .filter(label => { if (seen.has(label)) return false; seen.add(label); return true; })
      .slice(0, 7);

    if (!cities.length) { closeDropdown(); return; }
    renderDropdown(cities, q);
  } catch {
    closeDropdown();
  }
}

function showDropdownLoading() {
  cityDropdown.innerHTML = '<div class="ac-item ac-item--loading">SEARCHING...</div>';
  cityDropdown.classList.add('open');
}

function renderDropdown(cities, q) {
  acIndex = -1;
  const ql = q.toLowerCase();
  cityDropdown.innerHTML = cities.map(city => {
    const idx = city.toLowerCase().indexOf(ql);
    const hi = idx >= 0
      ? escHtml(city.slice(0, idx)) + '<mark>' + escHtml(city.slice(idx, idx + q.length)) + '</mark>' + escHtml(city.slice(idx + q.length))
      : escHtml(city);
    return `<div class="ac-item" data-city="${escHtml(city)}">${hi}</div>`;
  }).join('');
  cityDropdown.classList.add('open');

  cityDropdown.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('click', () => selectCity(el.dataset.city));
  });
}

function updateActive(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
  if (acIndex >= 0) items[acIndex]?.scrollIntoView({ block: 'nearest' });
}

function selectCity(city) {
  cityInput.value = city;
  closeDropdown();
  cityInput.focus();
}

function closeDropdown() {
  cityDropdown.classList.remove('open');
  acIndex = -1;
}

// ── UTILS ──
async function typewriter(el, text, speed = 18) {
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  cursor.textContent = '█';
  el.appendChild(cursor);
  for (const char of text) {
    cursor.before(document.createTextNode(char));
    await delay(speed);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
