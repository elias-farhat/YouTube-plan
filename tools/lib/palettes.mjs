// Colour palettes per channel. The look of a video = one palette + layout + pacing + ... picked from a seed.
// money: always dark with green / gold accents.  space & history: several moods each.
const P = (o) => o;

export const PALETTES = {
  money: {
    emerald_gold: P({ bgTop: '#04130f', bgBot: '#0b3a2b', glow: '#1fa97a', accent: '#3ddc97', accent2: '#ffd166', text: '#f4fff9', muted: '#8fc4b0', panel: '#0d2f25', bad: '#ff5d6c', onAccent: '#04150f' }),
    jade_champagne: P({ bgTop: '#061a17', bgBot: '#12483f', glow: '#2fbf8f', accent: '#4ade80', accent2: '#f4d58d', text: '#f6fffb', muted: '#97c9bb', panel: '#0f3a33', bad: '#ff6f7d', onAccent: '#04150f' }),
    forest_amber: P({ bgTop: '#07140c', bgBot: '#16381f', glow: '#58b33a', accent: '#84e36b', accent2: '#ffb703', text: '#f7fff3', muted: '#9fc79a', panel: '#12301a', bad: '#ff6259', onAccent: '#08140a' }),
    mint_bronze: P({ bgTop: '#031a14', bgBot: '#0f4a3a', glow: '#27c99a', accent: '#6ee7b7', accent2: '#d9a441', text: '#f3fffa', muted: '#86bfaa', panel: '#0c3a2e', bad: '#ff6b75', onAccent: '#04150f' }),
    lime_gold: P({ bgTop: '#0a1405', bgBot: '#26400d', glow: '#8fd11f', accent: '#b8f34a', accent2: '#ffd23f', text: '#fbfff0', muted: '#b0c78a', panel: '#1d3309', bad: '#ff6a5a', onAccent: '#0c1503' }),
    teal_sun: P({ bgTop: '#02161a', bgBot: '#0b4147', glow: '#1fb5a8', accent: '#34d399', accent2: '#fcd34d', text: '#f2fffd', muted: '#86bcb8', panel: '#0a3237', bad: '#ff7081', onAccent: '#031615' }),
  },
  space: {
    nebula: P({ bgTop: '#05030f', bgBot: '#160a33', glow: '#6a2cc9', glow2: '#ff4fa3', accent: '#7df9ff', accent2: '#ff7ad9', text: '#f6f4ff', muted: '#a79bd6', panel: '#1a1040', sun: '#ffd36b', bad: '#ff7a90', onAccent: '#05030f' }),
    aurora: P({ bgTop: '#020b12', bgBot: '#06302f', glow: '#12b886', glow2: '#2f6bff', accent: '#5cffb0', accent2: '#6ec5ff', text: '#effff8', muted: '#8ac7b2', panel: '#0a2a2a', sun: '#ffe27a', bad: '#ff8a7a', onAccent: '#02110d' }),
    mars: P({ bgTop: '#10050a', bgBot: '#3a1210', glow: '#d9532b', glow2: '#ffb347', accent: '#ffb347', accent2: '#ff6b4a', text: '#fff4ec', muted: '#d7a592', panel: '#2c0f0e', sun: '#ffd36b', bad: '#ff6b6b', onAccent: '#1c0803' }),
    deepgold: P({ bgTop: '#030812', bgBot: '#0a1c3d', glow: '#2551b8', glow2: '#ffcf5a', accent: '#ffcf5a', accent2: '#73b7ff', text: '#f6f9ff', muted: '#93a9d6', panel: '#0e2147', sun: '#ffcf5a', bad: '#ff7a7a', onAccent: '#0a1226' }),
    ice: P({ bgTop: '#030a14', bgBot: '#0e2f55', glow: '#4aa8ff', glow2: '#b6f0ff', accent: '#aeeaff', accent2: '#7aa7ff', text: '#f3fbff', muted: '#8fb7d6', panel: '#0c2748', sun: '#fff0b0', bad: '#ff8f9a', onAccent: '#04101c' }),
    violet: P({ bgTop: '#07030f', bgBot: '#25104f', glow: '#9b5cff', glow2: '#37e6c8', accent: '#37e6c8', accent2: '#c79bff', text: '#f8f4ff', muted: '#b3a1e0', panel: '#1d0f43', sun: '#ffd36b', bad: '#ff7da0', onAccent: '#06020f' }),
  },
  history: {
    sepia: P({ bgTop: '#1a120b', bgBot: '#33231a', glow: '#8a5a2b', sea: '#17384a', sea2: '#10293a', land: '#d9caa3', border: '#8b7650', accent: '#b3282d', accent2: '#e8b84a', text: '#fbf3e2', muted: '#c4b08a', panel: '#2a1d14', bad: '#e0605e', onAccent: '#fff7e8', ink: '#3a2a1a' }),
    midnight: P({ bgTop: '#060b18', bgBot: '#101d3a', glow: '#2f4f9a', sea: '#0b1a33', sea2: '#07111f', land: '#2c3d5c', border: '#5a7098', accent: '#f2c14e', accent2: '#ff7a59', text: '#f4f7ff', muted: '#98a8cc', panel: '#12213f', bad: '#ff7a59', onAccent: '#16120a', ink: '#e8eefc' }),
    terracotta: P({ bgTop: '#1f1410', bgBot: '#3d2218', glow: '#c8553d', sea: '#27403f', sea2: '#1b2e2d', land: '#ecd9b8', border: '#a58862', accent: '#c8553d', accent2: '#f0b67f', text: '#fff6ea', muted: '#d3b79a', panel: '#32201a', bad: '#e66a4e', onAccent: '#fff6ea', ink: '#3b2418' }),
    atlas: P({ bgTop: '#2a2a2e', bgBot: '#3a3d42', glow: '#8aa0a8', sea: '#a9cdd2', sea2: '#8fb9c0', land: '#f2e9d2', border: '#a28f69', accent: '#a4343a', accent2: '#2f6f8f', text: '#f4f1ea', muted: '#c2bfb4', panel: '#34363b', bad: '#a4343a', onAccent: '#fff7e8', ink: '#2b2118' }),
    ink: P({ bgTop: '#0b0d11', bgBot: '#1a1e26', glow: '#3a4252', sea: '#11151b', sea2: '#0b0e12', land: '#3b4048', border: '#6a7280', accent: '#ff5a36', accent2: '#ffd0a8', text: '#f3f4f6', muted: '#9aa1ad', panel: '#1b2029', bad: '#ff5a36', onAccent: '#1a0803', ink: '#f3f4f6' }),
    olive: P({ bgTop: '#10150f', bgBot: '#24301f', glow: '#7a8f4a', sea: '#1d3331', sea2: '#122422', land: '#cfd2b0', border: '#8d9170', accent: '#8e2f27', accent2: '#e3c26a', text: '#f6f4e4', muted: '#b5b894', panel: '#1f2a1b', bad: '#d1584c', onAccent: '#fff4e2', ink: '#2a2d1b' }),
  },
};
