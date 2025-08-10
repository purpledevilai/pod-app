export const theme = {
    colors: {
        bg: '#f7f9f7',
        text: '#222222',
        muted: '#9FA4A4',
        primary: '#3A965C',
        onPrimary: '#ffffff',
    },
    radii: { pill: 999, lg: 28 },
    space: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 },
    fonts: {
        regular: 'Outfit',
        semibold: 'OutfitSemi',
    },
} as const;
export type Theme = typeof theme;
