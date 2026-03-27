(() => {
  const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Cosmic'];
  const rarityPalettes = {
    Common: ['#c7d0dc', '#7d8797', '#243042'],
    Rare: ['#8bd3ff', '#2f7dff', '#0e1d49'],
    Epic: ['#d39bff', '#7c39ff', '#25114d'],
    Legendary: ['#ffd66a', '#ff9b21', '#4a2600'],
    Mythic: ['#ff98dc', '#ff5ca8', '#40113c'],
    Cosmic: ['#9ef7ff', '#9d7dff', '#0f1033']
  };

  const cardEntries = [
    {
      name: 'Mercury',
      category: 'Planet',
      rarity: 'Common',
      aura: 28,
      stats: { attack: 34, defense: 18, speed: 92, energy: 26 },
      lore: 'A sun-blasted runner with a metallic crust and razor-fast orbital reflexes.',
      sourceHint: 'NASA Mercury surface imagery',
      artPrompt: 'burnished crater world, solar flare rings, molten highlights',
      motif: 'solar scorched'
    },
    {
      name: 'Venus',
      category: 'Planet',
      rarity: 'Rare',
      aura: 49,
      stats: { attack: 44, defense: 52, speed: 31, energy: 58 },
      lore: 'A sulfur-lit pressure vault wrapped in glowing cloud banks and static storms.',
      sourceHint: 'NASA Venus cloud deck imagery',
      artPrompt: 'acid-gold atmosphere, glass storm bands, radiant veil',
      motif: 'cloud mantle'
    },
    {
      name: 'Earth',
      category: 'Planet',
      rarity: 'Legendary',
      aura: 86,
      stats: { attack: 70, defense: 82, speed: 64, energy: 88 },
      lore: 'The living shield, balancing ocean currents, storms, and a bright biosphere halo.',
      sourceHint: 'NASA Earth Blue Marble imagery',
      artPrompt: 'blue-white world, ocean glow, aurora rim, cloud swirl',
      motif: 'biosphere'
    },
    {
      name: 'Mars',
      category: 'Planet',
      rarity: 'Rare',
      aura: 53,
      stats: { attack: 57, defense: 41, speed: 48, energy: 49 },
      lore: 'A rusted arena where ancient river lines still whisper under dust storms.',
      sourceHint: 'NASA Mars global mosaic imagery',
      artPrompt: 'rust red desert sphere, canyon scars, storm halos',
      motif: 'dust war'
    },
    {
      name: 'Jupiter',
      category: 'Planet',
      rarity: 'Mythic',
      aura: 93,
      stats: { attack: 94, defense: 96, speed: 60, energy: 95 },
      lore: 'A thunder monarch with storm bands, charged belts, and an endless eye of pressure.',
      sourceHint: 'NASA Jupiter storm imagery',
      artPrompt: 'gas giant stripes, red storm eye, electric cloud spirals',
      motif: 'storm titan'
    },
    {
      name: 'Saturn',
      category: 'Planet',
      rarity: 'Legendary',
      aura: 88,
      stats: { attack: 68, defense: 84, speed: 53, energy: 90 },
      lore: 'A ringed relic whose ice bands glitter like a vault of frozen relics.',
      sourceHint: 'NASA Saturn ring imagery',
      artPrompt: 'golden gas giant, luminous rings, ice shards, halo geometry',
      motif: 'ring sovereign'
    },
    {
      name: 'Uranus',
      category: 'Planet',
      rarity: 'Epic',
      aura: 72,
      stats: { attack: 58, defense: 69, speed: 47, energy: 76 },
      lore: 'A sideways sentinel with glacial cyan tides and a cool magnetic pulse.',
      sourceHint: 'NASA Uranus imagery',
      artPrompt: 'cyan ice giant, tilted ring bands, smooth magnetic glow',
      motif: 'tilted ice'
    },
    {
      name: 'Neptune',
      category: 'Planet',
      rarity: 'Epic',
      aura: 75,
      stats: { attack: 63, defense: 66, speed: 71, energy: 79 },
      lore: 'A midnight vortex packed with winds that cut like ionized water.',
      sourceHint: 'NASA Neptune imagery',
      artPrompt: 'deep blue giant, wind shear streaks, bright storm eye',
      motif: 'storm current'
    },
    {
      name: 'Ceres',
      category: 'Dwarf Planet',
      rarity: 'Rare',
      aura: 57,
      stats: { attack: 39, defense: 66, speed: 29, energy: 54 },
      lore: "The asteroid belt's lantern, hiding salts and ancient brine traces below frost.",
      sourceHint: 'NASA Dawn mission Ceres imagery',
      artPrompt: 'pale rock world, salt bloom craters, frost lantern glow',
      motif: 'brine vault'
    },
    {
      name: 'Pluto',
      category: 'Dwarf Planet',
      rarity: 'Epic',
      aura: 74,
      stats: { attack: 52, defense: 74, speed: 34, energy: 71 },
      lore: 'A heart-lit frontier world of nitrogen frost, haze, and glacier motion.',
      sourceHint: 'NASA New Horizons Pluto imagery',
      artPrompt: 'heart-shaped frost plain, icy horizon, pink haze',
      motif: 'frost heart'
    },
    {
      name: 'Haumea',
      category: 'Dwarf Planet',
      rarity: 'Legendary',
      aura: 81,
      stats: { attack: 60, defense: 80, speed: 88, energy: 69 },
      lore: 'A spun crystal shard of the outer belt, flashing with a fast rotational edge.',
      sourceHint: 'IAU dwarf planet reference imagery',
      artPrompt: 'elongated icy shard, spinning arcs, sharp glints',
      motif: 'rotation blade'
    },
    {
      name: 'Eris',
      category: 'Dwarf Planet',
      rarity: 'Mythic',
      aura: 90,
      stats: { attack: 76, defense: 92, speed: 37, energy: 85 },
      lore: "A cold throne at the system's edge, heavy with quiet mass and deep shadow.",
      sourceHint: 'IAU dwarf planet reference imagery',
      artPrompt: 'icy silver dwarf, distant crown, dark edge lighting',
      motif: 'outer throne'
    },
    {
      name: 'Vesta',
      category: 'Asteroid',
      rarity: 'Common',
      aura: 36,
      stats: { attack: 42, defense: 35, speed: 58, energy: 33 },
      lore: 'A battle-scarred belt commander with volcanic memory etched into its crust.',
      sourceHint: 'NASA Dawn mission Vesta imagery',
      artPrompt: 'rocky asteroid, impact basin, ember cracks',
      motif: 'ash command'
    },
    {
      name: 'Pallas',
      category: 'Asteroid',
      rarity: 'Rare',
      aura: 47,
      stats: { attack: 49, defense: 51, speed: 44, energy: 46 },
      lore: 'A broad, ancient guardian with a lean frame and a steady defensive line.',
      sourceHint: 'Minor Planet Center Pallas reference',
      artPrompt: 'light stone asteroid, shield facets, orbit guard glow',
      motif: 'guard stone'
    },
    {
      name: 'Psyche',
      category: 'Asteroid',
      rarity: 'Epic',
      aura: 67,
      stats: { attack: 74, defense: 63, speed: 42, energy: 71 },
      lore: 'A metallic core fragment that reflects the age of lost planetary hearts.',
      sourceHint: 'NASA Psyche mission imagery',
      artPrompt: 'metallic asteroid, mirror facets, core shimmer',
      motif: 'iron mirror'
    },
    {
      name: 'Bennu',
      category: 'Asteroid',
      rarity: 'Epic',
      aura: 69,
      stats: { attack: 66, defense: 54, speed: 61, energy: 63 },
      lore: 'A carbon black shard with a careful orbit and a whisper of organic mystery.',
      sourceHint: 'NASA OSIRIS-REx Bennu imagery',
      artPrompt: 'dark spinning asteroid, gravel plume, raven arc',
      motif: 'carbon raven'
    },
    {
      name: 'Sun',
      category: 'Star',
      rarity: 'Mythic',
      aura: 96,
      stats: { attack: 98, defense: 91, speed: 88, energy: 99 },
      lore: 'The helio-crest, a roaring forge that sets every other card in motion.',
      sourceHint: 'NASA solar imagery',
      artPrompt: 'radiant star, coronal arches, bright plasma crown',
      motif: 'forge crown'
    },
    {
      name: 'Proxima Centauri',
      category: 'Star',
      rarity: 'Epic',
      aura: 78,
      stats: { attack: 71, defense: 62, speed: 54, energy: 82 },
      lore: 'A red dwarf pulse with compact power and an ever-watchful flare pattern.',
      sourceHint: 'ESO / NASA Proxima Centauri imagery',
      artPrompt: 'crimson star, compact flare loops, deep-space sparks',
      motif: 'red pulse'
    },
    {
      name: 'Sirius',
      category: 'Star',
      rarity: 'Legendary',
      aura: 89,
      stats: { attack: 85, defense: 70, speed: 78, energy: 86 },
      lore: 'A brilliant court star with a clean beam and a hard-to-ignore shine.',
      sourceHint: 'NASA / ESA Sirius imagery',
      artPrompt: 'blue-white star, courtly rays, elegant lens flare',
      motif: 'radiant court'
    },
    {
      name: 'Betelgeuse',
      category: 'Star',
      rarity: 'Legendary',
      aura: 91,
      stats: { attack: 92, defense: 65, speed: 41, energy: 94 },
      lore: 'A swollen supergiant bloom whose fading light still commands the sky.',
      sourceHint: 'ESO Betelgeuse imagery',
      artPrompt: 'red supergiant, luminous bloom, uneven stellar petals',
      motif: 'giant bloom'
    },
    {
      name: 'Sagittarius A*',
      category: 'Black Hole',
      rarity: 'Cosmic',
      aura: 100,
      stats: { attack: 100, defense: 99, speed: 58, energy: 100 },
      lore: 'A galactic anchor that bends every lane and pulls the room into silence.',
      sourceHint: 'EHT Sagittarius A* imagery',
      artPrompt: 'supermassive black hole, photon ring, warped spacetime arcs',
      motif: 'galactic anchor'
    },
    {
      name: 'M87*',
      category: 'Black Hole',
      rarity: 'Mythic',
      aura: 97,
      stats: { attack: 99, defense: 97, speed: 44, energy: 98 },
      lore: 'A shadow engine crowned by a blazing ring and a jet that writes across galaxies.',
      sourceHint: 'EHT M87* imagery',
      artPrompt: 'dark center, orange photon ring, luminous jet arc',
      motif: 'shadow engine'
    },
    {
      name: 'Cygnus X-1',
      category: 'Black Hole',
      rarity: 'Legendary',
      aura: 92,
      stats: { attack: 94, defense: 89, speed: 49, energy: 93 },
      lore: 'A vacuum spear that gulps starlight and pushes a hard jet into the void.',
      sourceHint: 'NASA Cygnus X-1 reference imagery',
      artPrompt: 'compact black hole, blue accretion arc, vacuum spear',
      motif: 'jet spear'
    },
    {
      name: 'Milky Way',
      category: 'Galaxy',
      rarity: 'Cosmic',
      aura: 99,
      stats: { attack: 96, defense: 100, speed: 67, energy: 100 },
      lore: 'A spiral veil filled with billions of hidden sparks and a long, luminous memory.',
      sourceHint: 'ESA / NASA Milky Way galactic map imagery',
      artPrompt: 'spiral galaxy, luminous dust lanes, bright core, cosmic fog',
      motif: 'spiral veil'
    },
    {
      name: 'Andromeda',
      category: 'Galaxy',
      rarity: 'Cosmic',
      aura: 98,
      stats: { attack: 95, defense: 99, speed: 61, energy: 99 },
      lore: 'A distant crown galaxy on a slow collision course with our own bright future.',
      sourceHint: 'NASA Andromeda galaxy imagery',
      artPrompt: 'broad spiral galaxy, blue-white core, long haze arms',
      motif: 'distant crown'
    }
  ];

  const cards = cardEntries.map((entry) => {
    const slug = entry.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      id: slug,
      name: entry.name,
      category: entry.category,
      rarity: entry.rarity,
      aura: entry.aura,
      stats: entry.stats,
      lore: entry.lore,
      visual: {
        sourceStrategy: 'generated-svg',
        sourceHint: entry.sourceHint,
        artPrompt: entry.artPrompt,
        motif: entry.motif
      }
    };
  });

  function svgToDataUri(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  function pickGlyph(card) {
    const glyphs = {
      Planet: '◌',
      'Dwarf Planet': '⧈',
      Asteroid: '✦',
      Star: '✸',
      'Black Hole': '◉',
      Galaxy: '✺'
    };
    return glyphs[card.category] ?? '◌';
  }

  function getCardAccent(card) {
    return rarityPalettes[card.rarity]?.[1] ?? rarityPalettes.Common[1];
  }

  function getRarityIndex(rarity) {
    const index = rarityOrder.indexOf(rarity);
    return index < 0 ? 0 : index;
  }

  function createCosmicArt(card) {
    const seed = hashSeed(card.id);
    const palette = rarityPalettes[card.rarity] ?? rarityPalettes.Common;
    const [base, accent, deep] = palette;
    const glyph = pickGlyph(card);
    const dash = 4 + (seed % 8);
    const rotation = seed % 360;
    const accentRgb = [
      parseInt(accent.slice(1, 3), 16),
      parseInt(accent.slice(3, 5), 16),
      parseInt(accent.slice(5, 7), 16)
    ];

    return svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640" role="img" aria-label="${card.name}">
        <defs>
          <linearGradient id="bg-${card.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${deep}" />
            <stop offset="55%" stop-color="${accent}" stop-opacity="0.72" />
            <stop offset="100%" stop-color="${base}" />
          </linearGradient>
          <radialGradient id="flare-${card.id}" cx="50%" cy="36%" r="66%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
            <stop offset="48%" stop-color="${accent}" stop-opacity="0.38" />
            <stop offset="100%" stop-color="${deep}" stop-opacity="0" />
          </radialGradient>
          <filter id="glow-${card.id}" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 0 1 0 0 0 0 0.75 0"
            />
          </filter>
        </defs>
        <rect width="480" height="640" rx="36" fill="url(#bg-${card.id})" />
        <circle cx="240" cy="205" r="168" fill="url(#flare-${card.id})" opacity="0.72" />
        <circle cx="240" cy="205" r="112" fill="none" stroke="rgba(${accentRgb.join(',')},0.48)" stroke-width="6" stroke-dasharray="18 ${dash}" transform="rotate(${rotation} 240 205)" />
        <circle cx="240" cy="205" r="72" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />
        <path d="M90 470 C170 410, 310 410, 390 470" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="4" />
        <path d="M100 476 C180 428, 300 428, 380 476" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="2" />
        <g filter="url(#glow-${card.id})">
          <text x="240" y="236" text-anchor="middle" font-size="120" font-family="Georgia, serif" fill="#ffffff" fill-opacity="0.95">${glyph}</text>
        </g>
        <g fill="#ffffff" fill-opacity="0.9">
          <circle cx="${110 + (seed % 40)}" cy="${122 + (seed % 96)}" r="4" />
          <circle cx="${360 - (seed % 56)}" cy="${148 + (seed % 44)}" r="3" />
          <circle cx="${380 - (seed % 24)}" cy="${94 + (seed % 65)}" r="2.8" />
          <circle cx="${96 + (seed % 18)}" cy="${320 + (seed % 30)}" r="2.4" />
          <circle cx="${370 - (seed % 36)}" cy="${350 + (seed % 22)}" r="3.4" />
        </g>
        <rect x="30" y="30" width="420" height="580" rx="28" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />
      </svg>`);
  }

  function createCardElement(card) {
    const item = document.createElement('article');
    item.className = 'cosmic-card';
    item.dataset.rarity = card.rarity;
    item.dataset.category = card.category;
    item.style.setProperty('--card-accent', getCardAccent(card));
    item.style.setProperty('--rarity-index', String(getRarityIndex(card.rarity)));

    const img = document.createElement('img');
    img.className = 'cosmic-card__art';
    img.alt = `${card.name} card art`;
    img.src = createCosmicArt(card);

    const header = document.createElement('header');
    header.className = 'cosmic-card__header';

    const name = document.createElement('h3');
    name.className = 'cosmic-card__name';
    name.textContent = card.name;

    const badges = document.createElement('div');
    badges.className = 'cosmic-card__badges';

    const category = document.createElement('span');
    category.className = 'cosmic-badge cosmic-badge--category';
    category.textContent = card.category;

    const rarity = document.createElement('span');
    rarity.className = 'cosmic-badge cosmic-badge--rarity';
    rarity.textContent = card.rarity;

    badges.append(category, rarity);
    header.append(name, badges);

    const aura = document.createElement('div');
    aura.className = 'cosmic-card__aura';
    aura.innerHTML = `<span>Aura</span><strong>${card.aura}</strong>`;

    const stats = document.createElement('dl');
    stats.className = 'cosmic-card__stats';

    for (const [label, value] of Object.entries(card.stats)) {
      const stat = document.createElement('div');
      stat.className = 'cosmic-card__stat';
      stat.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
      stats.append(stat);
    }

    const lore = document.createElement('p');
    lore.className = 'cosmic-card__lore';
    lore.textContent = card.lore;

    const source = document.createElement('p');
    source.className = 'cosmic-card__source';
    source.textContent = `${card.visual.sourceStrategy} fallback | ${card.visual.sourceHint}`;

    const footer = document.createElement('footer');
    footer.className = 'cosmic-card__footer';
    footer.innerHTML = `<span>${card.visual.motif}</span><span>${card.visual.artPrompt}</span>`;

    item.append(img, header, aura, stats, lore, source, footer);
    return item;
  }

  function renderCardLibrary() {
    const gallery = document.querySelector('[data-card-gallery]');
    const featured = document.querySelector('[data-featured-card]');
    const countNode = document.querySelector('[data-card-count]');

    if (countNode) {
      countNode.textContent = `${cards.length} cards, generated SVG art`;
    }

    if (gallery) {
      gallery.replaceChildren(...cards.map((card) => createCardElement(card)));
    }

    if (featured) {
      const card = cards.find((entry) => entry.rarity === 'Cosmic') ?? cards[0];
      const cardNode = createCardElement(card);
      cardNode.classList.add('cosmic-card--featured');
      featured.replaceChildren(cardNode);
    }
  }

  window.COSMIC_CARD_LIBRARY = cards;
  window.createCosmicCardArt = createCosmicArt;
  window.renderCosmicCardLibrary = renderCardLibrary;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCardLibrary, { once: true });
  } else {
    renderCardLibrary();
  }
})();
