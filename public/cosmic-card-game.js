(() => {
  const cardDatabase = Array.isArray(window.COSMIC_CARD_LIBRARY) ? window.COSMIC_CARD_LIBRARY : [];
  const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Cosmic'];
  const rarityWeights = [
    { rarity: 'Common', weight: 52 },
    { rarity: 'Rare', weight: 24 },
    { rarity: 'Epic', weight: 12 },
    { rarity: 'Legendary', weight: 7 },
    { rarity: 'Mythic', weight: 4 },
    { rarity: 'Cosmic', weight: 1 }
  ];
  const storageKey = 'cosmic-card-battle-save-v2';
  const elements = {};
  const state = {
    now: 0,
    soundEnabled: true,
    sortMode: 'rarity',
    stardust: 300,
    wins: 0,
    losses: 0,
    lastDailyPack: null,
    collection: {},
    selectedCardId: null,
    battle: null,
    pack: null,
    log: 'Ready to open a pack.',
    animating: false
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function weightedRandom(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry;
      }
    }
    return entries[entries.length - 1];
  }

  function randomFrom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getStats(card) {
    const owned = getOwnedCard(card);
    const levelBoost = Math.max(0, owned.level - 1) * 2;
    return {
      attack: card.stats.attack + levelBoost,
      defense: card.stats.defense + levelBoost,
      speed: card.stats.speed + levelBoost,
      energy: card.stats.energy + levelBoost,
      aura: card.aura + Math.floor(levelBoost * 1.5)
    };
  }

  function getOwnedCard(card) {
    const owned = state.collection[card.id];
    if (!owned) {
      return { ...card, copies: 0, level: 1, experience: 0 };
    }
    return { ...card, ...owned };
  }

  function ensureCollectionEntry(cardId) {
    if (!state.collection[cardId]) {
      state.collection[cardId] = { copies: 0, level: 1, experience: 0 };
    }
    return state.collection[cardId];
  }

  function getRarityBonus(rarity) {
    return rarityOrder.indexOf(rarity) + 1;
  }

  function getCardPower(card) {
    const stats = getStats(card);
    const owned = getOwnedCard(card);
    const weighted =
      stats.attack * 1.2 +
      stats.defense * 1.1 +
      stats.speed * 0.95 +
      stats.energy * 1.15 +
      stats.aura * 1.28;
    return Math.round(weighted + getRarityBonus(card.rarity) * 12 + Math.floor(owned.copies / 2) * 2);
  }

  function rarityClass(rarity) {
    return `rarity-${rarity.toLowerCase()}`;
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (typeof parsed.stardust === 'number') state.stardust = parsed.stardust;
      if (typeof parsed.wins === 'number') state.wins = parsed.wins;
      if (typeof parsed.losses === 'number') state.losses = parsed.losses;
      if (typeof parsed.lastDailyPack === 'string') state.lastDailyPack = parsed.lastDailyPack;
      if (typeof parsed.soundEnabled === 'boolean') state.soundEnabled = parsed.soundEnabled;
      if (typeof parsed.sortMode === 'string') state.sortMode = parsed.sortMode;
      if (parsed.collection && typeof parsed.collection === 'object') state.collection = parsed.collection;
      if (typeof parsed.selectedCardId === 'string') state.selectedCardId = parsed.selectedCardId;
    } catch (_) {}
  }

  function writeSave() {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        stardust: state.stardust,
        wins: state.wins,
        losses: state.losses,
        lastDailyPack: state.lastDailyPack,
        soundEnabled: state.soundEnabled,
        sortMode: state.sortMode,
        collection: state.collection,
        selectedCardId: state.selectedCardId
      })
    );
  }

  function awardCard(card) {
    const owned = ensureCollectionEntry(card.id);
    owned.copies += 1;
    owned.experience += 24 + getRarityBonus(card.rarity) * 6;
    while (owned.experience >= owned.level * 60) {
      owned.experience -= owned.level * 60;
      owned.level += 1;
    }
    state.selectedCardId = card.id;
    if (owned.copies > 1) {
      state.stardust += 35 + getRarityBonus(card.rarity) * 10;
    }
    return { card, owned };
  }

  function getSelectedCard() {
    const selectedId = state.selectedCardId || Object.keys(state.collection)[0];
    if (!selectedId) {
      return null;
    }
    return cardDatabase.find((card) => card.id === selectedId && state.collection[selectedId]) || null;
  }

  function openPack() {
    if (state.animating) {
      return;
    }
    const today = getTodayKey();
    const freePackAvailable = state.lastDailyPack !== today;
    if (!freePackAvailable && state.stardust < 100) {
      state.log = 'Not enough stardust. Win battles or wait for tomorrow\'s free pack.';
      syncView();
      return;
    }

    if (freePackAvailable) {
      state.lastDailyPack = today;
    } else {
      state.stardust -= 100;
    }

    const cards = [];
    for (let index = 0; index < 4; index += 1) {
      const rarity = weightedRandom(rarityWeights).rarity;
      const pool = cardDatabase.filter((card) => card.rarity === rarity);
      cards.push(randomFrom(pool));
    }

    state.pack = {
      phase: 'shake',
      startedAt: state.now,
      cards: cards.map((card, index) => ({
        card,
        revealAt: 1100 + index * 650,
        revealed: false
      }))
    };
    state.animating = true;
    state.log = freePackAvailable ? 'Daily free pack unlocked.' : 'Pack purchased and primed.';
    openPackOverlay();
    playSound('pack');
    syncView();
  }

  function battleWith(card) {
    const opponent = randomFrom(cardDatabase.filter((entry) => entry.id !== card.id));
    const playerPower = getCardPower(card);
    const opponentPower = getCardPower(opponent) + Math.round((Math.random() - 0.5) * 18);
    const winner = playerPower >= opponentPower ? 'player' : 'opponent';
    const difference = Math.abs(playerPower - opponentPower);

    state.battle = { player: card, opponent, playerPower, opponentPower, winner, difference };
    if (winner === 'player') {
      state.wins += 1;
      state.stardust += 60 + difference;
      ensureCollectionEntry(card.id).experience += 18;
    } else {
      state.losses += 1;
      state.stardust += 20;
    }

    state.log = winner === 'player' ? `${card.name} wins the duel.` : `${opponent.name} held the field.`;
    playSound(winner === 'player' ? 'win' : 'loss');
    elements.battleOverlay.classList.remove('hidden');
    elements.battleOverlay.setAttribute('aria-hidden', 'false');
    syncView();
  }

  function playSound(type) {
    if (!state.soundEnabled || !window.AudioContext) {
      return;
    }
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const tone = {
      pack: [440, 0.1, 'triangle'],
      win: [660, 0.14, 'triangle'],
      loss: [240, 0.14, 'sine']
    }[type] || [440, 0.1, 'sine'];
    oscillator.frequency.value = tone[0];
    oscillator.type = tone[2];
    gain.gain.value = 0.024;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + tone[1]);
    oscillator.onended = () => context.close();
  }

  function openPackOverlay() {
    elements.packOverlay.classList.remove('hidden');
    elements.packOverlay.setAttribute('aria-hidden', 'false');
  }

  function closePackOverlay() {
    elements.packOverlay.classList.add('hidden');
    elements.packOverlay.setAttribute('aria-hidden', 'true');
  }

  function updatePackAnimation() {
    if (!state.pack) {
      return;
    }
    const elapsed = state.now - state.pack.startedAt;
    state.pack.phase = elapsed < 1000 ? 'shake' : elapsed < 1600 ? 'burst' : 'reveal';
    for (const entry of state.pack.cards) {
      if (!entry.revealed && elapsed >= entry.revealAt) {
        entry.revealed = true;
        awardCard(entry.card);
      }
    }
    if (elapsed >= 4100) {
      state.animating = false;
      state.pack = null;
      closePackOverlay();
      state.log = 'Pack opened. Cards added to your archive.';
    }
  }

  function sortCollection(cards) {
    return cards.slice().sort((left, right) => {
      if (state.sortMode === 'aura') {
        return getCardPower(right) - getCardPower(left);
      }
      const rarityDelta = rarityOrder.indexOf(right.rarity) - rarityOrder.indexOf(left.rarity);
      return rarityDelta !== 0 ? rarityDelta : getCardPower(right) - getCardPower(left);
    });
  }

  function renderCollection() {
    const ownedCards = sortCollection(
      cardDatabase.filter((card) => state.collection[card.id]).map((card) => getOwnedCard(card))
    );
    elements.collectionGrid.innerHTML = '';
    if (!ownedCards.length) {
      elements.collectionGrid.innerHTML = '<div class="empty-state">Open your first pack to populate the archive.</div>';
      return;
    }

    for (const card of ownedCards) {
      const stats = getStats(card);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `card-tile ${rarityClass(card.rarity)}${state.selectedCardId === card.id ? ' selected' : ''}`;
      tile.innerHTML = `
        <div class="card-top">
          <span class="card-category">${card.category}</span>
          <span class="card-rarity">${card.rarity}</span>
        </div>
        <div class="card-art">
          <img src="${window.createCosmicCardArt(card)}" alt="${card.name} card art" loading="lazy" />
        </div>
        <h3>${card.name}</h3>
        <p>${card.lore}</p>
        <div class="card-stats">
          <span>ATK ${stats.attack}</span>
          <span>DEF ${stats.defense}</span>
          <span>SPD ${stats.speed}</span>
          <span>ENG ${stats.energy}</span>
        </div>
        <div class="card-footer">
          <span>Aura ${stats.aura}</span>
          <span>Lv ${card.level} x${card.copies}</span>
        </div>
      `;
      tile.addEventListener('click', () => {
        state.selectedCardId = card.id;
        state.log = `${card.name} is ready for battle.`;
        syncView();
      });
      elements.collectionGrid.appendChild(tile);
    }
  }

  function renderPackOverlay() {
    if (!state.pack) {
      return;
    }
    elements.packDrama.dataset.phase = state.pack.phase;
    const revealed = state.pack.cards.filter((entry) => entry.revealed);
    elements.packResults.innerHTML = revealed
      .map((entry, index) => {
        const card = getOwnedCard(entry.card);
        const specialPull = rarityOrder.indexOf(card.rarity) >= rarityOrder.indexOf('Legendary');
        return `
          <article class="reveal-card ${rarityClass(card.rarity)}${specialPull ? ' special-pull' : ''}" style="animation-delay:${index * 130}ms;">
            <div class="reveal-art"><img src="${window.createCosmicCardArt(card)}" alt="${card.name} art" /></div>
            <small>${card.category}</small>
            <h3>${card.name}</h3>
            <p>${card.rarity} aura ${getStats(card).aura}</p>
            <span>Lv ${card.level} x${card.copies}</span>
          </article>
        `;
      })
      .join('');
  }

  function renderBattle() {
    const selected = getSelectedCard();
    if (!state.battle) {
      elements.battleSummary.innerHTML = selected
        ? `
          <div class="battle-summary-grid">
            <span>Selected card</span><strong>${selected.name}</strong>
            <span>Total power</span><strong>${getCardPower(selected)}</strong>
            <span>Category</span><strong>${selected.category}</strong>
            <span>Rarity</span><strong>${selected.rarity}</strong>
          </div>
        `
        : 'Pick a card from your collection to see its power loadout.';
      return;
    }

    const { player, opponent, playerPower, opponentPower, winner, difference } = state.battle;
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

    elements.battlePlayer.className = `battle-side ${rarityClass(player.rarity)}`;
    elements.battleOpponent.className = `battle-side ${rarityClass(opponent.rarity)}`;
    elements.battlePlayer.innerHTML = `
      <div class="versus-art"><img src="${window.createCosmicCardArt(player)}" alt="${player.name} art" /></div>
      <h3>${player.name}</h3>
      <p>${player.category} · ${player.rarity}</p>
      <div class="versus-meta">Aura ${playerStats.aura} · Lv ${getOwnedCard(player).level}</div>
      <strong>${playerPower}</strong>
    `;
    elements.battleOpponent.innerHTML = `
      <div class="versus-art"><img src="${window.createCosmicCardArt(opponent)}" alt="${opponent.name} art" /></div>
      <h3>${opponent.name}</h3>
      <p>${opponent.category} · ${opponent.rarity}</p>
      <div class="versus-meta">Aura ${opponentStats.aura}</div>
      <strong>${opponentPower}</strong>
    `;
    elements.battleBars.innerHTML = rows
      .map(([label, playerValue, opponentValue]) => {
        const max = Math.max(playerValue, opponentValue);
        const playerWidth = clamp(Math.round((playerValue / max) * 100), 12, 100);
        const opponentWidth = clamp(Math.round((opponentValue / max) * 100), 12, 100);
        return `
          <div class="battle-bar-row">
            <span>${label}</span>
            <div class="battle-bar"><i style="width:${playerWidth}%"></i></div>
            <strong>${playerValue}</strong>
            <div class="battle-bar opponent"><i style="width:${opponentWidth}%"></i></div>
            <strong>${opponentValue}</strong>
          </div>
        `;
      })
      .join('');
    elements.battleResult.innerHTML = `
      <strong>${winner === 'player' ? 'Victory' : 'Defeat'}</strong>
      <span>${winner === 'player' ? `${player.name} wins by ${difference} power.` : `${opponent.name} wins by ${difference} power.`}</span>
    `;
    elements.battleSummary.innerHTML = `
      <div class="battle-summary-grid">
        <span>Result</span><strong>${winner === 'player' ? 'Victory' : 'Defeat'}</strong>
        <span>Reward</span><strong>${winner === 'player' ? `+${60 + difference} stardust` : '+20 stardust'}</strong>
        <span>Selected card</span><strong>${player.name}</strong>
        <span>Opponent</span><strong>${opponent.name}</strong>
      </div>
    `;
  }

  function renderHud() {
    const uniqueCount = Object.keys(state.collection).length;
    const freePackAvailable = state.lastDailyPack !== getTodayKey();
    elements.stardust.textContent = String(Math.max(0, Math.round(state.stardust)));
    elements.wins.textContent = String(state.wins);
    elements.losses.textContent = String(state.losses);
    elements.ownedCount.textContent = String(uniqueCount);
    elements.dailyPack.textContent = freePackAvailable ? 'Ready' : 'Claimed';
    elements.dailyPackNote.textContent = freePackAvailable ? 'One free pack is waiting for today.' : 'Come back tomorrow for another free opening.';
    elements.stardustNote.textContent = state.stardust >= 100 ? 'Enough to buy a pack.' : 'Battle to rebuild your stash.';
    elements.battleNote.textContent = state.wins > state.losses ? 'Your archive is glowing stronger.' : 'Any card can flip the next fight.';
    elements.ownedNote.textContent = uniqueCount ? `${uniqueCount} unique cards discovered.` : 'No cards claimed yet.';
    elements.packStatus.textContent = state.log;
    elements.openPackButton.textContent = freePackAvailable ? 'Claim Daily Pack' : 'Open Pack';
    elements.toggleSound.textContent = `Sound: ${state.soundEnabled ? 'On' : 'Off'}`;
  }

  function syncView() {
    renderHud();
    renderCollection();
    renderPackOverlay();
    renderBattle();
    writeSave();
  }

  function update(ms) {
    state.now += ms;
    updatePackAnimation();
  }

  function handleAction(action) {
    switch (action) {
      case 'open-pack':
        openPack();
        break;
      case 'battle-random': {
        const selected = getSelectedCard();
        if (!selected) {
          state.log = 'Select a card from your archive first.';
          syncView();
          return;
        }
        battleWith(selected);
        break;
      }
      case 'toggle-sound':
        state.soundEnabled = !state.soundEnabled;
        syncView();
        break;
      case 'sort-rarity':
        state.sortMode = 'rarity';
        syncView();
        break;
      case 'sort-aura':
        state.sortMode = 'aura';
        syncView();
        break;
      case 'close-battle':
        elements.battleOverlay.classList.add('hidden');
        elements.battleOverlay.setAttribute('aria-hidden', 'true');
        break;
    }
  }

  function bindDom() {
    elements.collectionGrid = document.querySelector('[data-collection-grid]');
    elements.packOverlay = document.querySelector('[data-pack-overlay]');
    elements.packDrama = document.querySelector('[data-pack-drama]');
    elements.packResults = document.querySelector('[data-pack-results]');
    elements.battleOverlay = document.querySelector('[data-battle-overlay]');
    elements.battlePlayer = document.querySelector('[data-battle-player]');
    elements.battleOpponent = document.querySelector('[data-battle-opponent]');
    elements.battleBars = document.querySelector('[data-battle-bars]');
    elements.battleResult = document.querySelector('[data-battle-result]');
    elements.battleSummary = document.querySelector('[data-battle-summary]');
    elements.packStatus = document.querySelector('[data-pack-status]');
    elements.stardust = document.querySelector('[data-stat="stardust"]');
    elements.stardustNote = document.querySelector('[data-stat="stardust-note"]');
    elements.dailyPack = document.querySelector('[data-stat="daily-pack"]');
    elements.dailyPackNote = document.querySelector('[data-stat="daily-pack-note"]');
    elements.wins = document.querySelector('[data-stat="wins"]');
    elements.losses = document.querySelector('[data-stat="losses"]');
    elements.ownedCount = document.querySelector('[data-stat="owned-count"]');
    elements.ownedNote = document.querySelector('[data-stat="owned-note"]');
    elements.battleNote = document.querySelector('[data-stat="battle-note"]');
    elements.openPackButton = document.querySelector('[data-action="open-pack"]');
    elements.toggleSound = document.querySelector('[data-action="toggle-sound"]');

    document.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
      const action = target?.dataset.action;
      if (action) {
        handleAction(action);
      }
    });
  }

  function renderTextState() {
    return JSON.stringify({
      origin: 'top-left',
      mode: state.pack ? `pack-${state.pack.phase}` : state.battle ? 'battle' : 'collection',
      stardust: state.stardust,
      wins: state.wins,
      losses: state.losses,
      selectedCardId: state.selectedCardId,
      pack: state.pack ? { phase: state.pack.phase, revealed: state.pack.cards.filter((entry) => entry.revealed).map((entry) => entry.card.id) } : null,
      battle: state.battle
        ? {
            player: state.battle.player.id,
            opponent: state.battle.opponent.id,
            playerPower: state.battle.playerPower,
            opponentPower: state.battle.opponentPower,
            winner: state.battle.winner
          }
        : null,
      collection: Object.entries(state.collection).map(([id, entry]) => ({ id, copies: entry.copies, level: entry.level, experience: entry.experience }))
    });
  }

  function startLoop() {
    let last = performance.now();
    function frame(now) {
      const delta = now - last;
      last = now;
      update(delta);
      syncView();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function bootstrap() {
    if (!cardDatabase.length) {
      return;
    }
    bindDom();
    readSave();
    if (state.collection[state.selectedCardId] == null) {
      state.selectedCardId = Object.keys(state.collection)[0] || null;
    }
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
