(() => {
  const rarityPalettes = {
    Common: ['#d5dde6', '#7d8b9b', '#253142'],
    Rare: ['#9edfff', '#3188ff', '#0d2251'],
    Epic: ['#ebb5ff', '#8a49ff', '#2d1154'],
    Legendary: ['#ffe18b', '#ffab32', '#4e2700'],
    Mythic: ['#ffb0dd', '#ff5ea9', '#45103c'],
    Cosmic: ['#a3fff3', '#8b89ff', '#12143b']
  };

  const cardEntries = [
    entry('Mercury', 'Planet', 'Common', 28, [34, 18, 92, 26], 'A tiny scorched runner hugging the sun.', 'Mercury_(planet)'),
    entry('Venus', 'Planet', 'Rare', 49, [44, 52, 31, 58], 'A pressure-wrapped inferno hidden behind bright clouds.', 'Venus'),
    entry('Earth', 'Planet', 'Epic', 64, [57, 66, 52, 61], 'A blue world of oceans, weather, and life.', 'Earth'),
    entry('Mars', 'Planet', 'Rare', 53, [57, 41, 48, 49], 'A rust-red frontier carved by dust storms and ancient rivers.', 'Mars'),
    entry('Jupiter', 'Planet', 'Legendary', 86, [83, 92, 52, 88], 'A storm giant with belts of thunder and crushing gravity.', 'Jupiter'),
    entry('Saturn', 'Planet', 'Legendary', 84, [72, 83, 53, 89], 'A ring-crowned monarch floating through the outer dark.', 'Saturn'),
    entry('Uranus', 'Planet', 'Epic', 71, [58, 67, 46, 75], 'A tilted ice giant with a cool magnetic hush.', 'Uranus'),
    entry('Neptune', 'Planet', 'Epic', 76, [63, 68, 71, 79], 'A deep-blue vortex of violent winds and bright storms.', 'Neptune'),

    entry('Ceres', 'Dwarf Planet', 'Rare', 56, [40, 64, 28, 53], 'The belt lantern hiding salt-bright scars.', 'Ceres_(dwarf_planet)'),
    entry('Pluto', 'Dwarf Planet', 'Epic', 74, [52, 74, 34, 71], 'A distant frost world with a bright heart plain.', 'Pluto'),
    entry('Haumea', 'Dwarf Planet', 'Legendary', 80, [60, 80, 88, 67], 'A fast-spinning shard stretched into a cosmic ellipse.', 'Haumea'),
    entry('Makemake', 'Dwarf Planet', 'Epic', 72, [54, 67, 41, 69], 'A reddish outpost wandering beyond Neptune.', 'Makemake'),
    entry('Eris', 'Dwarf Planet', 'Mythic', 90, [76, 92, 37, 85], 'A cold throne at the edge of the solar system.', 'Eris_(dwarf_planet)'),
    entry('Sedna', 'Dwarf Planet', 'Legendary', 82, [61, 86, 22, 78], 'An extreme wanderer on a nearly mythical orbit.', '90377_Sedna'),
    entry('Gonggong', 'Dwarf Planet', 'Epic', 70, [58, 72, 33, 68], 'A crimson outer-world orb with a haunting tint.', '225088_Gonggong'),
    entry('Quaoar', 'Dwarf Planet', 'Rare', 58, [43, 60, 30, 56], 'A distant belt body with quiet staying power.', '50000_Quaoar'),

    entry('Vesta', 'Asteroid', 'Common', 36, [42, 35, 58, 33], 'A battle-scarred protoplanet fragment.', '4_Vesta'),
    entry('Pallas', 'Asteroid', 'Rare', 47, [49, 51, 44, 46], 'A broad guardian rock on a steep orbital path.', '2_Pallas'),
    entry('Hygiea', 'Asteroid', 'Rare', 45, [41, 52, 34, 42], 'A dark giant of the main belt with steady mass.', '10_Hygiea'),
    entry('Psyche', 'Asteroid', 'Epic', 67, [74, 63, 42, 71], 'A metal-rich remnant of a lost planetary core.', '16_Psyche'),
    entry('Bennu', 'Asteroid', 'Epic', 69, [66, 54, 61, 63], 'A carbon-black rubble pile rich with ancient chemistry.', '101955_Bennu'),
    entry('Eros', 'Asteroid', 'Common', 31, [35, 28, 49, 28], 'A near-Earth traveler shaped by long collisions.', '433_Eros'),
    entry('Ida', 'Asteroid', 'Common', 30, [36, 31, 45, 27], 'A ridged stone worldlet trailed by old scars.', '243_Ida'),
    entry('Gaspra', 'Asteroid', 'Common', 29, [33, 29, 46, 25], 'An olive-shaped asteroid with a restless spin.', '951_Gaspra'),
    entry('Toutatis', 'Asteroid', 'Rare', 46, [48, 44, 53, 43], 'A tumbling near-Earth body with a chaotic rhythm.', '4179_Toutatis'),
    entry('Apophis', 'Asteroid', 'Epic', 68, [73, 48, 66, 59], 'A famous close-passing asteroid carrying tension and speed.', '99942_Apophis'),
    entry('Itokawa', 'Asteroid', 'Rare', 44, [40, 38, 55, 39], 'A peanut-shaped rubble pile mapped grain by grain.', '25143_Itokawa'),
    entry('Ryugu', 'Asteroid', 'Epic', 66, [62, 57, 58, 64], 'A spinning diamond of rock and carbon-rich rubble.', '162173_Ryugu'),
    entry('Lutetia', 'Asteroid', 'Rare', 43, [44, 47, 39, 41], 'A weathered relic from the early belt.', '21_Lutetia'),
    entry('Davida', 'Asteroid', 'Rare', 42, [39, 50, 33, 40], 'A hulking belt asteroid with a quietly heavy silhouette.', '511_Davida'),
    entry('Interamnia', 'Asteroid', 'Rare', 43, [41, 51, 34, 42], 'One of the belt\'s largest hidden bruisers.', '704_Interamnia'),
    entry('Juno', 'Asteroid', 'Rare', 45, [46, 42, 47, 41], 'A bright belt asteroid with a stony edge.', '3_Juno'),
    entry('Eunomia', 'Asteroid', 'Common', 34, [37, 36, 39, 31], 'A major belt rock with a fractured history.', '15_Eunomia'),
    entry('Sylvia', 'Asteroid', 'Rare', 46, [45, 48, 37, 44], 'A giant asteroid orbited by two tiny moons.', '87_Sylvia'),
    entry('Kleopatra', 'Asteroid', 'Epic', 65, [67, 55, 51, 62], 'A dog-bone asteroid with metallic shine and moons in tow.', '216_Kleopatra'),
    entry('Hektor', 'Asteroid', 'Epic', 63, [64, 58, 47, 60], 'A Trojan giant stretching like twin worlds fused together.', '624_Hektor'),
    entry('Patroclus', 'Asteroid', 'Rare', 48, [47, 49, 40, 46], 'A Trojan binary carrying quiet mass into the outer lanes.', '617_Patroclus'),

    entry('Sun', 'Star', 'Mythic', 96, [98, 91, 88, 99], 'The roaring forge at the center of our system.', 'Sun'),
    entry('Proxima Centauri', 'Star', 'Epic', 78, [71, 62, 54, 82], 'A red dwarf pulsing with compact nearby power.', 'Proxima_Centauri'),
    entry('Sirius', 'Star', 'Legendary', 89, [85, 70, 78, 86], 'The night sky\'s brightest beacon.', 'Sirius'),
    entry('Betelgeuse', 'Star', 'Legendary', 91, [92, 65, 41, 94], 'A swollen supergiant bloom on the verge of change.', 'Betelgeuse'),
    entry('Rigel', 'Star', 'Epic', 74, [77, 58, 66, 79], 'A brilliant blue giant throwing light like a spear.', 'Rigel'),
    entry('Polaris', 'Star', 'Rare', 55, [48, 61, 30, 57], 'A northern guide star holding steady in the sky.', 'Polaris'),
    entry('Vega', 'Star', 'Epic', 73, [69, 59, 70, 76], 'A bright white star with crisp, elegant radiance.', 'Vega'),
    entry('Canopus', 'Star', 'Epic', 72, [67, 63, 49, 77], 'A southern giant pouring out calm brilliance.', 'Canopus'),
    entry('Antares', 'Star', 'Legendary', 88, [89, 67, 39, 91], 'A red supergiant glowing like a warning flare.', 'Antares'),
    entry('Arcturus', 'Star', 'Rare', 59, [51, 55, 46, 60], 'An orange giant with warm, steady force.', 'Arcturus'),

    entry('Cygnus X-1', 'Black Hole', 'Legendary', 92, [94, 89, 49, 93], 'A famous stellar-mass black hole with a hard jet.', 'Cygnus_X-1'),
    entry('Sagittarius A*', 'Black Hole', 'Cosmic', 100, [100, 99, 58, 100], 'The supermassive anchor in the Milky Way core.', 'Sagittarius_A*'),
    entry('M87*', 'Black Hole', 'Mythic', 97, [99, 97, 44, 98], 'A shadow engine ringed in glowing infall.', 'M87*'),
    entry('TON 618', 'Black Hole', 'Cosmic', 102, [103, 96, 35, 104], 'A monster black hole blazing at quasar scale.', 'TON_618'),
    entry('Phoenix A', 'Black Hole', 'Mythic', 95, [100, 90, 32, 99], 'A ravenous giant at the heart of a galaxy cluster.', 'Phoenix_Cluster'),

    entry('Milky Way', 'Galaxy', 'Cosmic', 99, [96, 100, 67, 100], 'Our own spiral home spread across the night sky.', 'Milky_Way'),
    entry('Andromeda', 'Galaxy', 'Cosmic', 98, [95, 99, 61, 99], 'A grand neighboring spiral closing in over ages.', 'Andromeda_Galaxy'),
    entry('Triangulum Galaxy', 'Galaxy', 'Epic', 73, [67, 69, 58, 75], 'A smaller spiral glowing with young star fields.', 'Triangulum_Galaxy'),
    entry('Whirlpool Galaxy', 'Galaxy', 'Legendary', 85, [79, 82, 57, 87], 'A dramatic interacting spiral with luminous arms.', 'Whirlpool_Galaxy'),
    entry('Sombrero Galaxy', 'Galaxy', 'Legendary', 84, [78, 83, 53, 86], 'A haloed galaxy with a sharp dust-lane brim.', 'Sombrero_Galaxy'),
    entry('Pinwheel Galaxy', 'Galaxy', 'Mythic', 94, [88, 90, 61, 94], 'A face-on spiral blooming with blue star clusters.', 'Pinwheel_Galaxy'),
    entry('Cartwheel Galaxy', 'Galaxy', 'Legendary', 86, [80, 84, 64, 88], 'A collision-made ring galaxy still rippling outward.', 'Cartwheel_Galaxy'),
    entry('Black Eye Galaxy', 'Galaxy', 'Epic', 71, [66, 72, 47, 73], 'A spiral marked by a dramatic dark dust band.', 'Black_Eye_Galaxy')
  ];

  const cards = cardEntries.map((entry, index) => ({
    ...entry,
    id: slugify(entry.name),
    releaseOrder: index
  }));

  function entry(name, category, rarity, aura, [attack, defense, speed, energy], lore, wikiTitle) {
    return {
      name,
      category,
      rarity,
      aura,
      stats: { attack, defense, speed, energy },
      lore,
      visual: {
        wikiTitle,
        sourceStrategy: 'wikipedia-summary',
        sourceHint: `Wikipedia summary thumbnail for ${name}`
      }
    };
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

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

  function glyphFor(category) {
    const glyphs = {
      Planet: '\u25CE',
      'Dwarf Planet': '\u29c8',
      Asteroid: '\u2726',
      Star: '\u2738',
      'Black Hole': '\u25C9',
      Galaxy: '\u273A'
    };
    return glyphs[category] ?? '\u25CE';
  }

  function createFallbackArt(card) {
    const palette = rarityPalettes[card.rarity] ?? rarityPalettes.Common;
    const [base, accent, deep] = palette;
    const seed = hashSeed(card.id);
    const glyph = glyphFor(card.category);
    const rotation = seed % 360;
    return svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640" role="img" aria-label="${card.name}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${deep}" />
            <stop offset="60%" stop-color="${accent}" stop-opacity="0.72" />
            <stop offset="100%" stop-color="${base}" />
          </linearGradient>
          <radialGradient id="flare" cx="50%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
            <stop offset="42%" stop-color="${accent}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${deep}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="480" height="640" rx="40" fill="url(#bg)" />
        <circle cx="240" cy="210" r="170" fill="url(#flare)" />
        <circle cx="240" cy="210" r="108" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="7" transform="rotate(${rotation} 240 210)" />
        <text x="240" y="252" text-anchor="middle" font-size="136" font-family="Georgia, serif" fill="white" fill-opacity="0.96">${glyph}</text>
        <text x="240" y="548" text-anchor="middle" font-size="34" font-family="Trebuchet MS, sans-serif" fill="white" fill-opacity="0.92">${card.name}</text>
      </svg>
    `);
  }

  window.COSMIC_CARD_LIBRARY = cards;
  window.COSMIC_RARITY_PALETTES = rarityPalettes;
  window.createCosmicFallbackArt = createFallbackArt;
})();
