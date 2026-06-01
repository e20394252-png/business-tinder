/* ========================================
   Business Tinder — Main App Logic
   ======================================== */

const API_BASE = window.location.origin;
let tg = null;
let initData = '';
let currentUser = null;
let currentCard = null;
let matchedUsername = null;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#F8F6F4');
    tg.setBackgroundColor('#F8F6F4');
    initData = tg.initData || '';
  }
  authenticate();
  setupNavigation();
  setupActions();
  setupSettings();
});

// ========== API Helper ==========
async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData || 'dev_bypass',
    ...options.headers
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ========== Auth ==========
async function authenticate() {
  try {
    currentUser = await api('/api/auth', { method: 'POST' });
    showApp();
    loadNextProfile();
    loadMatches();
    updateSettingsUI();
  } catch (err) {
    console.error('Auth failed:', err);
    document.querySelector('#loading-screen .loading-logo p').textContent = 'Ошибка авторизации';
    document.querySelector('.loading-spinner').classList.add('hidden');
  }
}

function showApp() {
  document.getElementById('loading-screen').classList.remove('active');
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

// ========== Navigation ==========
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const screenId = tab.dataset.screen;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('#app > .screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
      });
      const screen = document.getElementById(screenId);
      screen.classList.remove('hidden');
      screen.classList.add('active');
      if (screenId === 'matches-screen') loadMatches();
    });
  });
}

// ========== Profile Cards ==========
async function loadNextProfile() {
  try {
    const data = await api('/api/profiles/next');
    const stack = document.getElementById('card-stack');
    const empty = document.getElementById('empty-state');
    const actions = document.getElementById('swipe-actions');

    if (!data.profile) {
      stack.innerHTML = '';
      empty.classList.remove('hidden');
      actions.classList.add('hidden');
      currentCard = null;
      return;
    }

    empty.classList.add('hidden');
    actions.classList.remove('hidden');
    currentCard = data.profile;
    renderCard(data.profile);
  } catch (err) {
    console.error('Load profile error:', err);
  }
}

function renderCard(profile) {
  const stack = document.getElementById('card-stack');
  stack.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileId = profile.id;

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || 'Аноним';
  const photoHTML = profile.photoUrl
    ? `<img src="${profile.photoUrl}" alt="${name}" loading="eager">`
    : `<span class="card-photo-placeholder">👤</span>`;

  card.innerHTML = `
    <div class="swipe-indicator like">LIKE</div>
    <div class="swipe-indicator pass">NOPE</div>
    <div class="card-photo">${photoHTML}</div>
    <div class="card-info">
      <div class="card-name">${escapeHtml(name)}</div>
      ${profile.bio ? `<div class="card-bio">${escapeHtml(profile.bio)}</div>` : ''}
    </div>
  `;

  setupSwipeGestures(card);
  stack.appendChild(card);
}

// ========== Swipe Gestures ==========
function setupSwipeGestures(card) {
  let startX = 0, startY = 0, currentX = 0, isDragging = false;
  const threshold = 100;

  function onStart(e) {
    isDragging = true;
    card.classList.add('dragging');
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    currentX = 0;
  }

  function onMove(e) {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    currentX = point.clientX - startX;
    const rotation = currentX * 0.1;
    const opacity = Math.min(Math.abs(currentX) / threshold, 1);

    card.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

    const likeIndicator = card.querySelector('.swipe-indicator.like');
    const passIndicator = card.querySelector('.swipe-indicator.pass');
    likeIndicator.style.opacity = currentX > 0 ? opacity : 0;
    passIndicator.style.opacity = currentX < 0 ? opacity : 0;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('dragging');

    if (Math.abs(currentX) > threshold) {
      const direction = currentX > 0 ? 'LIKE' : 'PASS';
      animateOut(card, currentX > 0 ? 1 : -1);
      processSwipe(direction);
    } else {
      card.style.transform = '';
      card.querySelector('.swipe-indicator.like').style.opacity = 0;
      card.querySelector('.swipe-indicator.pass').style.opacity = 0;
    }
  }

  card.addEventListener('mousedown', onStart);
  card.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function animateOut(card, direction) {
  card.classList.add('animate-out');
  card.style.transform = `translateX(${direction * 500}px) rotate(${direction * 30}deg)`;
  card.style.opacity = '0';
}

// ========== Action Buttons ==========
function setupActions() {
  document.getElementById('btn-pass').addEventListener('click', () => {
    if (!currentCard) return;
    const card = document.querySelector('.profile-card');
    if (card) animateOut(card, -1);
    processSwipe('PASS');
  });

  document.getElementById('btn-like').addEventListener('click', () => {
    if (!currentCard) return;
    const card = document.querySelector('.profile-card');
    if (card) animateOut(card, 1);
    processSwipe('LIKE');
  });

  document.getElementById('match-popup-continue').addEventListener('click', () => {
    document.getElementById('match-popup').classList.add('hidden');
  });

  document.getElementById('match-popup-write').addEventListener('click', () => {
    document.getElementById('match-popup').classList.add('hidden');
    if (matchedUsername) {
      window.open(`https://t.me/${matchedUsername}`, '_blank');
    }
  });
}

// ========== Process Swipe ==========
async function processSwipe(direction) {
  if (!currentCard) return;
  const targetId = currentCard.id;

  try {
    const result = await api('/api/swipe', {
      method: 'POST',
      body: JSON.stringify({ targetId, direction })
    });

    if (result.isMatch) {
      showMatchPopup(result.matchedUser);
    }
  } catch (err) {
    console.error('Swipe error:', err);
  }

  setTimeout(() => loadNextProfile(), 400);
}

// ========== Match Popup ==========
function showMatchPopup(matchedUser) {
  const popup = document.getElementById('match-popup');
  const name = [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(' ') || matchedUser.username || 'Аноним';
  document.getElementById('match-popup-text').textContent = `${name} тоже хочет познакомиться!`;
  matchedUsername = matchedUser.username;

  const myAvatar = document.getElementById('match-popup-my-avatar');
  const theirAvatar = document.getElementById('match-popup-their-avatar');

  if (currentUser.photoUrl) {
    myAvatar.innerHTML = `<img src="${currentUser.photoUrl}" alt="Вы">`;
  }
  if (matchedUser.photoUrl) {
    theirAvatar.innerHTML = `<img src="${matchedUser.photoUrl}" alt="${name}">`;
  }

  const writeBtn = document.getElementById('match-popup-write');
  if (matchedUser.username) {
    writeBtn.classList.remove('hidden');
  } else {
    writeBtn.classList.add('hidden');
  }

  popup.classList.remove('hidden');
  if (tg) tg.HapticFeedback?.notificationOccurred('success');
}

// ========== Matches List ==========
async function loadMatches() {
  try {
    const data = await api('/api/matches');
    const list = document.getElementById('matches-list');
    const empty = document.getElementById('matches-empty');
    const badge = document.getElementById('match-badge');

    if (!data.matches || data.matches.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      badge.classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    badge.textContent = data.matches.length;
    badge.classList.remove('hidden');

    list.innerHTML = data.matches.map((m, i) => {
      const user = m.user;
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Аноним';
      const date = new Date(m.matchedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const avatarContent = user.photoUrl
        ? `<img src="${user.photoUrl}" alt="${escapeHtml(name)}">`
        : '👤';
      const writeUrl = user.username ? `https://t.me/${user.username}` : '#';

      return `
        <div class="match-card" style="animation-delay:${i * 0.05}s">
          <div class="match-avatar">${avatarContent}</div>
          <div class="match-info">
            <div class="match-name">${escapeHtml(name)}</div>
            <div class="match-bio">${escapeHtml(user.bio || '')}</div>
            <div class="match-date">${date}</div>
          </div>
          <a href="${writeUrl}" target="_blank" class="match-write-btn" ${!user.username ? 'style="opacity:0.5;pointer-events:none"' : ''}>Написать</a>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load matches error:', err);
  }
}

// ========== Settings ==========
function setupSettings() {
  const checkbox = document.getElementById('notify-checkbox');
  checkbox.addEventListener('change', async () => {
    try {
      await api('/api/profiles/settings', {
        method: 'PUT',
        body: JSON.stringify({ notifyOnMatch: checkbox.checked })
      });
      if (tg) tg.HapticFeedback?.impactOccurred('light');
    } catch (err) {
      console.error('Settings error:', err);
      checkbox.checked = !checkbox.checked;
    }
  });
}

function updateSettingsUI() {
  if (!currentUser) return;
  const name = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'Пользователь';
  document.getElementById('settings-name').textContent = name;
  document.getElementById('settings-username').textContent = currentUser.username ? `@${currentUser.username}` : '';
  document.getElementById('notify-checkbox').checked = currentUser.notifyOnMatch;

  const avatar = document.getElementById('settings-avatar');
  if (currentUser.photoUrl) {
    avatar.innerHTML = `<img src="${currentUser.photoUrl}" alt="${name}">`;
  }
}

// ========== Helpers ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
