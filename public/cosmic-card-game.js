(() => {
  const cardDatabase = Array.isArray(window.COSMIC_CARD_LIBRARY) ? window.COSMIC_CARD_LIBRARY : [];
  const palettes = window.COSMIC_RARITY_PALETTES || {};
  const createFallbackArt = window.createCosmicFallbackArt;
  const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Cosmic'];
  const rarityWeights = [
    { rarity: 'Common', weight: 52 },
    { rarity: 'Rare', weight: 24 },
    { rarity: 'Epic', weight: 12 },
    { rarity: 'Legendary', weight: 7 },
    { rarity: 'Mythic', weight: 4 },
    { rarity: 'Cosmic', weight: 1 }
  ];
  const saveKey = 'project-planet-save-v3';
  const imageCacheKey = 'project-planet-image-cache-v1';
  const imageCache = readImageCache();
  const imageRequests = {};
  const elements = {};
  const state = {
    now: 0,
    activeTab: 'packs',
    soundEnabled: true,
    sortMode: 'rarity',
    stardust: 300,
    wins: 0,
    losses: 0,
    lastDailyPack: null,
    collection: {},
    selectedCardId: null,
    latestPullIds: [],
    battleHistory: [],
    pack: null,
    battle: null,
    log: 'Ready to open a pack.',
    animatingPack: false
  };

  function weightedRandom(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  function randomFrom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function rarityClass(rarity) {
    return `rarity-${rarity.toLowerCase()}`;
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(saveKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.stardust === 'number') state.stardust = parsed.stardust;
      if (typeof parsed.wins === 'number') state.wins = parsed.wins;
      if (typeof parsed.losses === 'number') state.losses = parsed.losses;
      if (typeof parsed.lastDailyPack === 'string') state.lastDailyPack = parsed.lastDailyPack;
      if (typeof parsed.soundEnabled === 'boolean') state.soundEnabled = parsed.soundEnabled;
      if (typeof parsed.sortMode === 'string') state.sortMode = parsed.sortMode;
      if (typeof parsed.activeTab === 'string') state.activeTab = parsed.activeTab;
      if (parsed.collection && typeof parsed.collection === 'object') state.collection = parsed.collection;
      if (typeof parsed.selectedCardId === 'string') state.selectedCardId = parsed.selectedCardId;
      if (Array.isArray(parsed.latestPullIds)) state.latestPullIds = parsed.latestPullIds;
      if (Array.isArray(parsed.battleHistory)) state.battleHistory = parsed.battleHistory.slice(0, 6);
    } catch (_) {}
  }

  function writeSave() {
    window.localStorage.setItem(
      saveKey,
      JSON.stringify({
        stardust: state.stardust,
        wins: state.wins,
        losses: state.losses,
        lastDailyPack: state.lastDailyPack,
        soundEnabled: state.soundEnabled,
        sortMode: state.sortMode,
        activeTab: state.activeTab,
        collection: state.collection,
        selectedCardId: state.selectedCardId,
        latestPullIds: state.latestPullIds,
        battleHistory: state.battleHistory.slice(0, 6)
      })
    );
  }

  function readImageCache() {
    try {
      const raw = window.localStorage.getItem(imageCacheKey);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeImageCache() {
    try {
      window.localStorage.setItem(imageCacheKey, JSON.stringify(imageCache));
    } catch (_) {}
  }

  function getOwnedMeta(cardId) {
    return state.collection[cardId] || null;
  }

  function ensureOwned(cardId) {
    if (!state.collection[cardId]) {
      state.collection[cardId] = { copies: 0, level: 1, experience: 0 };
    }
    return state.collection[cardId];
  }

  function getOwnedCards() {
    return cardDatabase.filter((card) => state.collection[card.id]).map((card) => ({ ...card, owned: state.collection[card.id] }));
  }

  function getStats(card) {
    const owned = getOwnedMeta(card.id);
    const levelBoost = owned ? Math.max(0, owned.level - 1) * 2 : 0;
    return {
      attack: card.stats.attack + levelBoost,
      defense: card.stats.defense + levelBoost,
      speed: card.stats.speed + levelBoost,
      energy: card.stats.energy + levelBoost,
      aura: card.aura + Math.floor(levelBoost * 1.4)
    };
  }

  function getCardPower(card) {
    const stats = getStats(card);
    const owned = getOwnedMeta(card.id);
    return Math.round(
      stats.attack * 1.15 +
        stats.defense * 1.1 +
        stats.speed * 0.95 +
        stats.energy * 1.15 +
        stats.aura * 1.3 +
        (rarityOrder.indexOf(card.rarity) + 1) * 11 +
        (owned ? Math.floor(owned.copies / 2) * 2 : 0)
    );
  }

  function awardCard(card) {
    const owned = ensureOwned(card.id);
    owned.copies += 1;
    owned.experience += 24 + (rarityOrder.indexOf(card.rarity) + 1) * 6;
    while (owned.experience >= owned.level * 60) {
      owned.experience -= owned.level * 60;
      owned.level += 1;
    }
    if (owned.copies > 1) {
      state.stardust += 30 + (rarityOrder.indexOf(card.rarity) + 1) * 8;
    }
    state.selectedCardId = card.id;
  }

  function getSelectedOwnedCard() {
    const selectedId = state.selectedCardId || Object.keys(state.collection)[0];
    if (!selectedId) return null;
    return cardDatabase.find((card) => card.id === selectedId && state.collection[selectedId]) || null;
  }

  async function getCardImage(card) {
    if (imageCache[card.id]) return imageCache[card.id];
    if (imageRequests[card.id]) return imageRequests[card.id];
    const wikiTitle = card.visual?.wikiTitle;
    if (!wikiTitle) {
      const fallback = createFallbackArt(card);
      imageCache[card.id] = fallback;
      writeImageCache();
      return fallback;
    }
    imageRequests[card.id] = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`)
      .then((response) => response.json())
      .then((data) => data?.originalimage?.source || data?.thumbnail?.source || createFallbackArt(card))
      .catch(() => createFallbackArt(card))
      .then((source) => {
        imageCache[card.id] = source;
        writeImageCache();
        delete imageRequests[card.id];
        return source;
      });
    return imageRequests[card.id];
  }

  function queueImageLoad(card, img) {
    getCardImage(card).then((source) => {
      if (img.isConnected) img.src = source;
    });
  }

  function createCardTile(card, options = {}) {
    const owned = getOwnedMeta(card.id);
    const stats = getStats(card);
    const tile = document.createElement(options.tagName || 'button');
    tile.className = `collection-card ${rarityClass(card.rarity)}${state.selectedCardId === card.id ? ' is-selected' : ''}`;
    if (tile.tagName === 'BUTTON') tile.type = 'button';
    const img = document.createElement('img');
    img.className = 'collection-card__image';
    img.alt = `${card.name} image`;
    img.src = createFallbackArt(card);
    queueImageLoad(card, img);

    const imageFrame = document.createElement('div');
    imageFrame.className = 'collection-card__image-frame';
    imageFrame.appendChild(img);

    const title = document.createElement('h3');
    title.textContent = card.name;

    const meta = document.createElement('div');
    meta.className = 'collection-card__meta';
    meta.innerHTML = `<span>${card.category}</span><span>${card.rarity}</span>`;

    const lore = document.createElement('p');
    lore.className = 'collection-card__lore';
    lore.textContent = card.lore;

    const statsRow = document.createElement('div');
    statsRow.className = 'collection-card__stats';
    statsRow.innerHTML = `
      <span>ATK ${stats.attack}</span>
      <span>DEF ${stats.defense}</span>
      <span>SPD ${stats.speed}</span>
      <span>ENG ${stats.energy}</span>
    `;

    const footer = document.createElement('div');
    footer.className = 'collection-card__footer';
    footer.innerHTML = owned
      ? `<span>Aura ${stats.aura}</span><span>Lv ${owned.level} · x${owned.copies}</span>`
      : `<span>Aura ${stats.aura}</span><span>Unowned</span>`;

    tile.append(imageFrame, meta, title, lore, statsRow, footer);
    return tile;
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    for (const button of document.querySelectorAll('[data-tab]')) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    }
    for (const panel of document.querySelectorAll('[data-panel]')) {
      panel.classList.toggle('is-active', panel.dataset.panel === tab);
    }
    writeSave();
  }

  function openPack() {
    if (state.animatingPack) return;
    const hasFreePack = state.lastDailyPack !== todayKey();
    if (!hasFreePack && state.stardust < 100) {
      state.log = 'Not enough stardust. Win a battle or come back for your daily pack.';
      syncView();
      return;
    }
    if (hasFreePack) state.lastDailyPack = todayKey();
    else state.stardust -= 100;

    const pulls = [];
    for (let index = 0; index < 4; index += 1) {
      const rarity = weightedRandom(rarityWeights).rarity;
      const pool = cardDatabase.filter((card) => card.rarity === rarity);
      pulls.push(randomFrom(pool));
    }

    state.pack = {
      phase: 'shake',
      startedAt: state.now,
      cards: pulls.map((card, index) => ({
        card,
        revealAt: 900 + index * 700,
        revealed: false
      }))
    };
    state.animatingPack = true;
    state.log = hasFreePack ? 'Daily pack opened.' : 'Paid pack opening...';
    elements.packOverlay.classList.remove('hidden');
    elements.packOverlay.setAttribute('aria-hidden', 'false');
    playSound('pack');
    syncView();
  }

  function updatePack() {
    if (!state.pack) return false;
    const elapsed = state.now - state.pack.startedAt;
    let changed = false;
    state.pack.phase = elapsed < 900 ? 'shake' : elapsed < 1500 ? 'burst' : 'reveal';
    for (const entry of state.pack.cards) {
      if (!entry.revealed && elapsed >= entry.revealAt) {
        entry.revealed = true;
        awardCard(entry.card);
        state.latestPullIds.unshift(entry.card.id);
        state.latestPullIds = Array.from(new Set(state.latestPullIds)).slice(0, 8);
        changed = true;
      }
    }
    if (elapsed >= 4300) {
      state.animatingPack = false;
      state.pack = null;
      state.log = 'Pack opened. Your collection has been updated.';
      elements.packOverlay.classList.add('hidden');
      elements.packOverlay.setAttribute('aria-hidden', 'true');
      changed = true;
    }
    return changed;
  }

  function runBattle() {
    const selected = getSelectedOwnedCard();
    if (!selected) {
      state.log = 'Open a pack and select a collected card before battling.';
      setActiveTab('collection');
      syncView();
      return;
    }
    const opponent = randomFrom(cardDatabase.filter((card) => card.id !== selected.id));
    const playerPower = getCardPower(selected);
    const opponentPower = Math.round(getCardPower(opponent) * (0.94 + Math.random() * 0.12));
    const winner = playerPower >= opponentPower ? 'player' : 'opponent';
    const margin = Math.abs(playerPower - opponentPower);
    state.battle = { player: selected, opponent, playerPower, opponentPower, winner, margin };
    state.battleHistory.unshift({
      player: selected.name,
      opponent: opponent.name,
      winner,
      margin
    });
    state.battleHistory = state.battleHistory.slice(0, 5);
    if (winner === 'player') {
      state.wins += 1;
      state.stardust += 55 + margin;
      ensureOwned(selected.id).experience += 18;
      state.log = `${selected.name} won the battle.`;
    } else {
      state.losses += 1;
      state.stardust += 20;
      state.log = `${opponent.name} took the victory.`;
    }
    elements.battleOverlay.classList.remove('hidden');
    elements.battleOverlay.setAttribute('aria-hidden', 'false');
    setActiveTab('battle');
    playSound(winner === 'player' ? 'win' : 'loss');
    syncView();
  }

  function playSound(type) {
    if (!state.soundEnabled || !window.AudioContext) return;
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const tones = {
      pack: [420, 0.12, 'triangle'],
      win: [690, 0.14, 'triangle'],
      loss: [240, 0.15, 'sine']
    };
    const [freq, duration, shape] = tones[type] || [400, 0.1, 'sine'];
    oscillator.frequency.value = freq;
    oscillator.type = shape;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => context.close();
  }

  function sortOwnedCards(cards) {
    return cards.slice().sort((left, right) => {
      if (state.sortMode === 'aura') return getCardPower(right) - getCardPower(left);
      const rarityDiff = rarityOrder.indexOf(right.rarity) - rarityOrder.indexOf(left.rarity);
      if (rarityDiff !== 0) return rarityDiff;
      return left.releaseOrder - right.releaseOrder;
    });
  }

  function renderPreview() {
    const card = getSelectedOwnedCard() || cardDatabase.find((entry) => entry.rarity === 'Cosmic') || cardDatabase[0];
    elements.featuredCard.innerHTML = '';
    if (!card) return;
    const preview = createCardTile(card, { tagName: 'article' });
    preview.classList.add('collection-card--preview');
    elements.featuredCard.appendChild(preview);
  }

  function renderRecentPulls() {
    elements.recentPulls.innerHTML = '';
    const cards = state.latestPullIds.length
      ? state.latestPullIds.map((id) => cardDatabase.find((card) => card.id === id)).filter(Boolean)
      : cardDatabase.slice(0, 4);
    for (const card of cards.slice(0, 4)) {
      const tile = createCardTile(card, { tagName: 'article' });
      tile.classList.add('recent-card');
      elements.recentPulls.appendChild(tile);
    }
  }

  function renderCollection() {
    const owned = sortOwnedCards(getOwnedCards().map((entry) => entry));
    elements.collectionGrid.innerHTML = '';
    if (!owned.length) {
      elements.collectionGrid.innerHTML = '<div class="empty-state">Your collection is empty. Open a pack to earn your first cards.</div>';
      return;
    }
    for (const card of owned) {
      const tile = createCardTile(card);
      tile.addEventListener('click', () => {
        state.selectedCardId = card.id;
        state.log = `${card.name} selected for battle.`;
        syncView();
      });
      elements.collectionGrid.appendChild(tile);
    }
  }

  function renderPackOverlay() {
    if (!state.pack) {
      elements.packResults.innerHTML = '';
      return;
    }
    elements.packDrama.dataset.phase = state.pack.phase;
    const revealed = state.pack.cards.filter((entry) => entry.revealed);
    elements.packResults.innerHTML = '';
    for (const entry of revealed) {
      const card = entry.card;
      const tile = createCardTile(card, { tagName: 'article' });
      tile.classList.add('pack-reveal-card');
      if (rarityOrder.indexOf(card.rarity) >= rarityOrder.indexOf('Legendary')) {
        tile.classList.add('pack-reveal-card--special');
      }
      elements.packResults.appendChild(tile);
    }
  }

  function renderSelectedBattleCard() {
    elements.battleSelected.innerHTML = '';
    const selected = getSelectedOwnedCard();
    if (!selected) {
      elements.battleSelected.innerHTML = '<div class="empty-state">No battle-ready card yet. Pull one from a pack first.</div>';
      return;
    }
    const tile = createCardTile(selected, { tagName: 'article' });
    tile.classList.add('collection-card--preview');
    elements.battleSelected.appendChild(tile);
  }

  function renderBattleHistory() {
    if (!state.battleHistory.length) {
      elements.battleHistory.innerHTML = '<div class="empty-state">No battles yet. Pick a card and start your first match.</div>';
      return;
    }
    elements.battleHistory.innerHTML = state.battleHistory
      .map(
        (item) => `
          <article class="history-row ${item.winner === 'player' ? 'is-win' : 'is-loss'}">
            <strong>${item.player}</strong>
            <span>vs ${item.opponent}</span>
            <small>${item.winner === 'player' ? 'Victory' : 'Defeat'} by ${item.margin}</small>
          </article>
        `
      )
      .join('');
  }

  function renderBattleOverlay() {
    if (!state.battle) {
      elements.battlePlayer.innerHTML = '';
      elements.battleOpponent.innerHTML = '';
      elements.battleBars.innerHTML = '';
      elements.battleResult.innerHTML = '';
      return;
    }
    const { player, opponent, playerPower, opponentPower, winner, margin } = state.battle;
    const playerStats = getStats(player);
    const opponentStats = getStats(opponent);
    const rows = [
      ['Attack', playerStats.attack, opponentStats.attack],
      ['Defense', playerStats.defense, opponentStats.defense],
      ['Speed', playerStats.speed, opponentStats.speed],
      ['Energy', playerStats.energy, opponentStats.energy],
      ['Aura', playerStats.aura, opponentStats.aura],
      ['Total Power', playerPower, opponentPower]
    ];
    elements.battlePlayer.innerHTML = '';
    elements.battleOpponent.innerHTML = '';
    const playerCard = createCardTile(player, { tagName: 'article' });
    const opponentCard = createCardTile(opponent, { tagName: 'article' });
    playerCard.classList.add('collection-card--preview');
    opponentCard.classList.add('collection-card--preview');
    elements.battlePlayer.appendChild(playerCard);
    elements.battleOpponent.appendChild(opponentCard);
    elements.battleBars.innerHTML = rows
      .map(([label, left, right]) => {
        const max = Math.max(left, right);
        const leftWidth = clamp(Math.round((left / max) * 100), 10, 100);
        const rightWidth = clamp(Math.round((right / max) * 100), 10, 100);
        return `
          <div class="battle-bar-row">
            <span>${label}</span>
            <div class="battle-bar"><i style="width:${leftWidth}%"></i></div>
            <strong>${left}</strong>
            <div class="battle-bar battle-bar--opponent"><i style="width:${rightWidth}%"></i></div>
            <strong>${right}</strong>
          </div>
        `;
      })
      .join('');
    elements.battleResult.innerHTML = `
      <strong>${winner === 'player' ? 'Victory' : 'Defeat'}</strong>
      <span>${winner === 'player' ? `${player.name} won by ${margin} power.` : `${opponent.name} won by ${margin} power.`}</span>
    `;
    elements.battleSummary.innerHTML = `
      <div class="battle-summary-grid">
        <span>Ready card</span><strong>${player.name}</strong>
        <span>Total power</span><strong>${playerPower}</strong>
        <span>Opponent</span><strong>${opponent.name}</strong>
        <span>Opponent power</span><strong>${opponentPower}</strong>
        <span>Result</span><strong>${winner === 'player' ? 'Victory' : 'Defeat'}</strong>
        <span>Reward</span><strong>${winner === 'player' ? `+${55 + margin} Stardust` : '+20 Stardust'}</strong>
      </div>
    `;
  }

  function renderHud() {
    const ownedCards = getOwnedCards();
    const categoryCount = new Set(ownedCards.map((card) => card.category)).size;
    const selected = getSelectedOwnedCard();
    const freePack = state.lastDailyPack !== todayKey();
    elements.stardust.textContent = String(Math.round(state.stardust));
    elements.wins.textContent = String(state.wins);
    elements.losses.textContent = String(state.losses);
    elements.ownedCount.textContent = String(ownedCards.length);
    elements.dailyPack.textContent = freePack ? 'Ready' : 'Claimed';
    elements.dailyPackNote.textContent = freePack ? 'Your free daily pull is waiting.' : 'Come back tomorrow for another free pack.';
    elements.stardustNote.textContent = state.stardust >= 100 ? 'Enough for another pack.' : 'Battle to earn more stardust.';
    elements.ownedNote.textContent = ownedCards.length ? `${ownedCards.length} owned cards in your archive.` : 'No cards pulled yet.';
    elements.battleNote.textContent = state.wins + state.losses ? 'Your record updates after each arena match.' : 'Your first battle is still ahead.';
    elements.packStatus.textContent = state.log;
    elements.packCost.textContent = freePack ? 'Free pack available today' : '100 Stardust per paid pack';
    elements.openPackButton.textContent = freePack ? 'Claim Daily Pack' : 'Open Pack';
    elements.toggleSound.textContent = `Sound: ${state.soundEnabled ? 'On' : 'Off'}`;
    elements.categorySummary.textContent = ownedCards.length ? `${categoryCount} categories discovered` : '0 categories discovered';
    elements.selectionSummary.textContent = selected ? `${selected.name} selected for battle` : 'No card selected';
  }

  function syncView() {
    renderHud();
    renderPreview();
    renderRecentPulls();
    renderCollection();
    renderSelectedBattleCard();
    renderBattleHistory();
    renderPackOverlay();
    renderBattleOverlay();
    setActiveTab(state.activeTab);
    writeSave();
  }

  function update(ms) {
    state.now += ms;
    return updatePack();
  }

  function renderTextState() {
    return JSON.stringify({
      origin: 'top-left',
      tab: state.activeTab,
      stardust: state.stardust,
      ownedCards: Object.keys(state.collection).length,
      selectedCardId: state.selectedCardId,
      pack: state.pack
        ? {
            phase: state.pack.phase,
            revealed: state.pack.cards.filter((entry) => entry.revealed).map((entry) => entry.card.id)
          }
        : null,
      battle: state.battle
        ? {
            player: state.battle.player.id,
            opponent: state.battle.opponent.id,
            winner: state.battle.winner
          }
        : null
    });
  }

  function handleAction(action, target) {
    switch (action) {
      case 'switch-tab':
        setActiveTab(target.dataset.tab || 'packs');
        break;
      case 'open-pack':
        setActiveTab('packs');
        openPack();
        break;
      case 'sort-rarity':
        state.sortMode = 'rarity';
        syncView();
        break;
      case 'sort-aura':
        state.sortMode = 'aura';
        syncView();
        break;
      case 'battle-random':
        runBattle();
        break;
      case 'toggle-sound':
        state.soundEnabled = !state.soundEnabled;
        syncView();
        break;
      case 'close-pack':
        if (state.pack) {
          for (const entry of state.pack.cards) {
            if (!entry.revealed) {
              entry.revealed = true;
              awardCard(entry.card);
            }
          }
          state.pack = null;
          state.animatingPack = false;
          elements.packOverlay.classList.add('hidden');
          state.log = 'Pack opened. Your collection has been updated.';
          syncView();
        }
        break;
      case 'close-battle':
        elements.battleOverlay.classList.add('hidden');
        elements.battleOverlay.setAttribute('aria-hidden', 'true');
        break;
    }
  }

  function bindDom() {
    elements.featuredCard = document.querySelector('[data-featured-card]');
    elements.recentPulls = document.querySelector('[data-recent-pulls]');
    elements.collectionGrid = document.querySelector('[data-collection-grid]');
    elements.battleSelected = document.querySelector('[data-battle-selected]');
    elements.battleHistory = document.querySelector('[data-battle-history]');
    elements.packOverlay = document.querySelector('[data-pack-overlay]');
    elements.packDrama = document.querySelector('[data-pack-drama]');
    elements.packResults = document.querySelector('[data-pack-results]');
    elements.battleOverlay = document.querySelector('[data-battle-overlay]');
    elements.battlePlayer = document.querySelector('[data-battle-player]');
    elements.battleOpponent = document.querySelector('[data-battle-opponent]');
    elements.battleBars = document.querySelector('[data-battle-bars]');
    elements.battleResult = document.querySelector('[data-battle-result]');
    elements.battleSummary = document.querySelector('[data-battle-summary]');
    elements.stardust = document.querySelector('[data-stat="stardust"]');
    elements.stardustNote = document.querySelector('[data-stat="stardust-note"]');
    elements.wins = document.querySelector('[data-stat="wins"]');
    elements.losses = document.querySelector('[data-stat="losses"]');
    elements.ownedCount = document.querySelector('[data-stat="owned-count"]');
    elements.ownedNote = document.querySelector('[data-stat="owned-note"]');
    elements.dailyPack = document.querySelector('[data-stat="daily-pack"]');
    elements.dailyPackNote = document.querySelector('[data-stat="daily-pack-note"]');
    elements.battleNote = document.querySelector('[data-stat="battle-note"]');
    elements.packStatus = document.querySelector('[data-pack-status]');
    elements.packCost = document.querySelector('[data-pack-cost]');
    elements.openPackButton = document.querySelector('[data-action="open-pack"]');
    elements.toggleSound = document.querySelector('[data-action="toggle-sound"]');
    elements.categorySummary = document.querySelector('[data-category-summary]');
    elements.selectionSummary = document.querySelector('[data-selection-summary]');

    document.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
      if (!target) return;
      handleAction(target.dataset.action, target);
    });
  }

  function startLoop() {
    let last = performance.now();
    const frame = (now) => {
      const delta = now - last;
      last = now;
      const changed = update(delta);
      if (changed) syncView();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function bootstrap() {
    if (!cardDatabase.length) return;
    bindDom();
    readSave();
    if (!getSelectedOwnedCard()) state.selectedCardId = Object.keys(state.collection)[0] || null;
    syncView();
    startLoop();
  }

  window.advanceTime = (ms) => {
    update(ms);
    syncView();
  };
  window.render_game_to_text = renderTextState;

  bootstrap();
})();
