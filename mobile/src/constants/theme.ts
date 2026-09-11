export const colors = {
    background: "#121212",
    // Bumped up from #1E1E1E/#262626 — those were too close to background to read
    // as distinct "cards" on a real phone screen, which is why the redesign looked
    // like nothing had changed even though the structure was correct.
    surface: "#262626",
    surfaceRaised: "#333333",
    accent: "#8B5CF6",
    accentMuted: "#8B5CF629",
    // Semantic colors so ratings/likes/actions don't all reuse the same purple —
    // gold for ratings/stars and rose for likes are near-universal conventions.
    // Kept deliberately restrained (not neon-bright) so they read as accents on
    // black rather than colored patches — color lives in icon glyphs, not fills.
    rating: "#E0A63C",
    ratingMuted: "#E0A63C29",
    like: "#D6516F",
    likeMuted: "#D6516F29",
    text: "#FFFFFF",
    textMuted: "#A0A0A0",
    border: "#3D3D3D",
    error: "#FF6B6B",
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const radius = {
    sm: 6,
    md: 10,
    lg: 16,
    pill: 999,
};

// A single reusable card-elevation style — spread onto a View's style array.
// (iOS reads the shadow* props, Android reads elevation; both are needed.)
export const cardShadow = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
};

// A distinct display face for titles/headers only — body text stays on the
// system font. Loaded once in the root layout via useFonts; falls back to
// the system font automatically if a screen renders before fonts finish
// loading, since RN just ignores an unknown fontFamily name.
export const fonts = {
    displayBold: "SpaceGrotesk_700Bold",
    displaySemiBold: "SpaceGrotesk_600SemiBold",
};
