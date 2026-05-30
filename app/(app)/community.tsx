import { Text } from '@/src/components/ui/Text';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import React from 'react';
import {
    Dimensions,
    Image,
    ImageBackground,
    ImageSourcePropType,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// ── Static mock data ──────────────────────────────────────────────────────────

const COMMUNITY_STATS = {
    tonnesDiverted: 8241,
    households: 3812,
    treesSaved: 12400,
    co2TonnesAvoided: 4.8,
    energyGWh: 2.3,
};

const MATERIAL_STATS = [
    { label: 'Food & Garden', tonnes: 3820, color: '#6DBF67' },
    { label: 'Containers',    tonnes: 2140, color: '#4EACD1' },
    { label: 'Glass',         tonnes: 1100, color: '#9B59B6' },
    { label: 'Cardboard',     tonnes: 730,  color: '#E8A838' },
    { label: 'Soft Plastics', tonnes: 451,  color: '#E07B54' },
];

const COUNCIL_LEADERBOARD = [
    { rank: 1, name: 'City of Melbourne',     tonnes: 1241 },
    { rank: 2, name: 'Inner West Council',    tonnes: 987  },
    { rank: 3, name: 'City of Sydney',        tonnes: 843  },
    { rank: 4, name: 'City of Yarra',         tonnes: 612  },
    { rank: 5, name: 'Moreland City Council', tonnes: 589  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    return n.toLocaleString('en-AU');
}

function medalForRank(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.  `;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default observer(function CommunityScreen() {
    const { colors, space } = useTheme();
    const { authStore } = useStores();
    const points = authStore.user?.points ?? 0;
    const userItems = Math.floor(points / 5);
    const userKg = (userItems * 0.15).toFixed(1);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: space.lg }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </Pressable>
                <Text weight="bold" size={20}>Community</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Hero Banner ────────────────────────────────────────────── */}
                <ImageBackground
                    source={require('@/assets/images/community/hero_banner.png')}
                    style={styles.heroBanner}
                    resizeMode="cover"
                >
                    <View style={styles.heroScrim}>
                        <Text size={13} color="rgba(255,255,255,0.72)" style={{ marginBottom: 4 }}>
                            Everything becomes something.
                        </Text>
                        <Text weight="bold" size={52} color="#ffffff" style={{ lineHeight: 56 }}>
                            {fmt(COMMUNITY_STATS.tonnesDiverted)}t
                        </Text>
                        <Text size={17} weight="semibold" color="rgba(255,255,255,0.92)">
                            diverted from landfill
                        </Text>
                        <Text size={13} color="rgba(255,255,255,0.6)" style={{ marginTop: 6 }}>
                            by {fmt(COMMUNITY_STATS.households)} Pod households
                        </Text>
                    </View>
                </ImageBackground>

                <View style={{ paddingHorizontal: space.lg }}>

                    {/* ── Collective Impact ──────────────────────────────────── */}
                    <Text weight="bold" size={18} style={{ marginTop: space.xl, marginBottom: space.md }}>
                        Our Collective Impact
                    </Text>
                    <View style={styles.impactRow}>
                        <ImpactCard
                            image={require('@/assets/images/community/community_icon_trees.png')}
                            value={fmt(COMMUNITY_STATS.treesSaved)}
                            label="trees saved"
                            bg="#E8F5E9"
                        />
                        <ImpactCard
                            image={require('@/assets/images/community/community_icon_co2.png')}
                            value={`${COMMUNITY_STATS.co2TonnesAvoided}t`}
                            label="CO₂ avoided"
                            bg="#0f1d3a"
                            dark
                        />
                        <ImpactCard
                            image={require('@/assets/images/community/community_icon_energy.png')}
                            value={`${COMMUNITY_STATS.energyGWh} GWh`}
                            label="energy saved"
                            bg="#FFFDE7"
                        />
                    </View>

                    {/* ── Community Map ──────────────────────────────────────── */}
                    <Text weight="bold" size={18} style={{ marginTop: space.xl, marginBottom: 6 }}>
                        {fmt(COMMUNITY_STATS.households)} Households Recycling Smarter
                    </Text>
                    <Text size={14} color={colors.muted} style={{ marginBottom: space.md }}>
                        Pod communities spread across Australia
                    </Text>
                </View>

                {/* Map — full bleed with padding from wrapper edge */}
                <View style={{ paddingHorizontal: space.lg }}>
                    <View style={styles.mapContainer}>
                        <Image
                            source={require('@/assets/images/community/community_map.png')}
                            style={styles.mapImage}
                            resizeMode="cover"
                        />
                    </View>
                </View>

                {/* ── What We're Recycling ──────────────────────────────────── */}
                <View style={{ paddingHorizontal: space.lg }}>
                    <Text weight="bold" size={18} style={{ marginTop: space.xl, marginBottom: space.sm }}>
                        What We're Recycling
                    </Text>
                    <Text size={14} color={colors.muted} style={{ marginBottom: space.md }}>
                        Community totals by material stream
                    </Text>
                </View>

                {/* Materials illustration — full width */}
                <Image
                    source={require('@/assets/images/community/community_materials.png')}
                    style={styles.materialsImage}
                    resizeMode="contain"
                />

                {/* Material bars */}
                <View style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
                    {MATERIAL_STATS.map((m) => (
                        <MaterialBar
                            key={m.label}
                            label={m.label}
                            tonnes={m.tonnes}
                            total={COMMUNITY_STATS.tonnesDiverted}
                            color={m.color}
                        />
                    ))}

                    {/* ── Council Leaderboard ────────────────────────────────── */}
                    <Text weight="bold" size={18} style={{ marginTop: space.xl, marginBottom: space.md }}>
                        Council Champions
                    </Text>

                    <View style={[styles.card, { borderColor: `${colors.muted}35` }]}>
                        {COUNCIL_LEADERBOARD.map((entry, i) => (
                            <View
                                key={entry.rank}
                                style={[
                                    styles.leaderboardRow,
                                    i < COUNCIL_LEADERBOARD.length - 1 && {
                                        borderBottomWidth: 0.5,
                                        borderBottomColor: `${colors.muted}35`,
                                    },
                                ]}
                            >
                                <Text size={22} style={styles.medal}>{medalForRank(entry.rank)}</Text>
                                <Text size={15} style={{ flex: 1 }}>{entry.name}</Text>
                                <Text size={15} weight="semibold" color={colors.primary}>
                                    {fmt(entry.tonnes)}t
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* ── Your Contribution ─────────────────────────────────── */}
                    <Text weight="bold" size={18} style={{ marginTop: space.xl, marginBottom: space.md }}>
                        Your Contribution
                    </Text>

                    <View style={[styles.card, styles.contributionCard, {
                        backgroundColor: `${colors.primary}10`,
                        borderColor: `${colors.primary}30`,
                    }]}>
                        <View style={styles.contributionRow}>
                            <View style={styles.contributionStat}>
                                <Text size={34} weight="bold" color={colors.primary}>{userItems}</Text>
                                <Text size={12} color={colors.muted} style={{ marginTop: 2, textAlign: 'center' }}>
                                    items recycled
                                </Text>
                            </View>
                            <View style={[styles.contributionDivider, { backgroundColor: `${colors.primary}25` }]} />
                            <View style={styles.contributionStat}>
                                <Text size={34} weight="bold" color={colors.primary}>{userKg}kg</Text>
                                <Text size={12} color={colors.muted} style={{ marginTop: 2, textAlign: 'center' }}>
                                    diverted from landfill
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.contributionFooter, { borderTopColor: `${colors.primary}20` }]}>
                            <Ionicons name="leaf" size={14} color={colors.primary} />
                            <Text size={13} color={colors.primary} style={{ marginLeft: 6 }}>
                                Every item counts. Keep going!
                            </Text>
                        </View>
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
});

// ── ImpactCard ────────────────────────────────────────────────────────────────

function ImpactCard({ image, value, label, bg, dark }: {
    image: ImageSourcePropType;
    value: string;
    label: string;
    bg: string;
    dark?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <View style={[styles.impactCard, { backgroundColor: bg }]}>
            <Image source={image} style={styles.impactIcon} resizeMode="contain" />
            <Text
                weight="bold"
                size={17}
                color={dark ? '#ffffff' : colors.text}
                style={{ marginTop: 8, textAlign: 'center' }}
            >
                {value}
            </Text>
            <Text
                size={12}
                color={dark ? 'rgba(255,255,255,0.65)' : colors.muted}
                style={{ textAlign: 'center', marginTop: 2 }}
            >
                {label}
            </Text>
        </View>
    );
}

// ── MaterialBar ───────────────────────────────────────────────────────────────

function MaterialBar({ label, tonnes, total, color }: {
    label: string;
    tonnes: number;
    total: number;
    color: string;
}) {
    const { colors } = useTheme();
    const pct = Math.round((tonnes / total) * 100);
    return (
        <View style={styles.materialRow}>
            <View style={styles.materialLabel}>
                <View style={[styles.materialDot, { backgroundColor: color }]} />
                <Text size={14} color={colors.text}>{label}</Text>
            </View>
            <View style={styles.materialBarTrack}>
                <View style={[styles.materialBarFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text size={13} weight="semibold" color={colors.text} style={styles.materialTonnes}>
                {fmt(tonnes)}t
            </Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        padding: 4,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 48,
    },

    // Hero
    heroBanner: {
        width: '100%',
        height: 250,
        justifyContent: 'flex-end',
    },
    heroScrim: {
        backgroundColor: 'rgba(0,0,0,0.44)',
        paddingHorizontal: 24,
        paddingVertical: 22,
    },

    // Impact cards
    impactRow: {
        flexDirection: 'row',
        gap: 10,
    },
    impactCard: {
        flex: 1,
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    impactIcon: {
        width: 52,
        height: 52,
    },

    // Map
    mapContainer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    mapImage: {
        width: '100%',
        height: Math.round(screenWidth * 0.56),
    },

    // Materials
    materialsImage: {
        width: screenWidth,
        height: 110,
    },
    materialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    materialLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 122,
        gap: 8,
    },
    materialDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        flexShrink: 0,
    },
    materialBarTrack: {
        flex: 1,
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    materialBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    materialTonnes: {
        width: 54,
        textAlign: 'right',
    },

    // Leaderboard
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 10,
    },
    medal: {
        width: 30,
        textAlign: 'center',
    },

    // Contribution
    contributionCard: {
        borderWidth: 1.5,
    },
    contributionRow: {
        flexDirection: 'row',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    contributionStat: {
        flex: 1,
        alignItems: 'center',
    },
    contributionDivider: {
        width: 1,
        marginVertical: 4,
    },
    contributionFooter: {
        borderTopWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
});
