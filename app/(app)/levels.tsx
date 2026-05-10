import { Text } from '@/src/components/ui/Text';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const BADGE_CARD_HEIGHT = 220;
const HEADER_HEIGHT = 160;

const LEVELS = [
    {
        level: 1,
        name: 'Bin Beginner',
        pointsRequired: 0,
        badge: require('@/assets/badges/1_bin_beginner.png'),
        color: '#6DBF67',
        description: 'Every recycling journey starts with a single toss.',
    },
    {
        level: 2,
        name: 'Sorting Scout',
        pointsRequired: 50,
        badge: require('@/assets/badges/2_sorting_scout.png'),
        color: '#4EACD1',
        description: "You're getting the hang of sorting your waste.",
    },
    {
        level: 3,
        name: 'Material Handler',
        pointsRequired: 150,
        badge: require('@/assets/badges/3_material_handler.png'),
        color: '#E8A838',
        description: 'Materials are no mystery to you anymore.',
    },
    {
        level: 4,
        name: 'Recovery Operator',
        pointsRequired: 350,
        badge: require('@/assets/badges/4_recovery_operator.png'),
        color: '#E07B54',
        description: 'You rescue resources from the landfill.',
    },
    {
        level: 5,
        name: 'Circular Citizen',
        pointsRequired: 700,
        badge: require('@/assets/badges/5_circular_citizen.png'),
        color: '#9B59B6',
        description: "You're living the circular economy life.",
    },
    {
        level: 6,
        name: 'Resource Guardian',
        pointsRequired: 1250,
        badge: require('@/assets/badges/6_resource_gardian.png'),
        color: '#3498DB',
        description: 'A true protector of the planet\'s precious resources.',
    },
    {
        level: 7,
        name: 'Circular Economy Architect',
        pointsRequired: 2000,
        badge: require('@/assets/badges/7_circular_economy_architect.png'),
        color: '#F1C40F',
        description: 'You are building the future of waste-free living.',
    },
];

function getCurrentLevelIndex(points: number): number {
    let idx = 0;
    for (let i = 0; i < LEVELS.length; i++) {
        if (points >= LEVELS[i].pointsRequired) {
            idx = i;
        }
    }
    return idx;
}

function getProgressToNext(points: number, currentIdx: number): number {
    const current = LEVELS[currentIdx];
    const next = LEVELS[currentIdx + 1];
    if (!next) return 1;
    const range = next.pointsRequired - current.pointsRequired;
    const earned = points - current.pointsRequired;
    return Math.min(earned / range, 1);
}

interface BadgeCardProps {
    levelData: (typeof LEVELS)[number];
    index: number;
    currentIdx: number;
    points: number;
    isCurrentLevel: boolean;
    isUnlocked: boolean;
    spinAnim: Animated.Value;
    floatAnim: Animated.Value;
    glowAnim: Animated.Value;
}

const BadgeCard = React.memo(function BadgeCard({
    levelData,
    index,
    currentIdx,
    points,
    isCurrentLevel,
    isUnlocked,
    spinAnim,
    floatAnim,
    glowAnim,
}: BadgeCardProps) {
    const { colors, space } = useTheme();
    const nextLevel = LEVELS[index + 1];

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const floatY = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -10],
    });

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1],
    });

    const badgeScale = isCurrentLevel ? 1 : isUnlocked ? 0.88 : 0.78;

    return (
        <View
            style={[
                styles.badgeCard,
                {
                    backgroundColor: isUnlocked
                        ? colors.bg
                        : 'rgba(128,128,128,0.07)',
                    borderColor: isCurrentLevel
                        ? levelData.color
                        : isUnlocked
                        ? `${levelData.color}55`
                        : `${colors.muted}30`,
                    borderWidth: isCurrentLevel ? 2.5 : 1,
                },
            ]}
        >
            {/* Level number pill */}
            <View
                style={[
                    styles.levelPill,
                    {
                        backgroundColor: isUnlocked
                            ? levelData.color
                            : colors.muted,
                        opacity: isUnlocked ? 1 : 0.4,
                    },
                ]}
            >
                <Text
                    size={11}
                    weight="bold"
                    color="#fff"
                    style={{ letterSpacing: 0.5 }}
                >
                    LEVEL {levelData.level}
                </Text>
            </View>

            {/* Badge image with animation */}
            <Animated.View
                style={[
                    styles.badgeImageContainer,
                    isCurrentLevel && {
                        transform: [
                            { rotate: spin },
                            { translateY: floatY },
                            { scale: badgeScale },
                        ],
                    },
                    !isCurrentLevel && { transform: [{ scale: badgeScale }] },
                ]}
            >
                {isCurrentLevel && (
                    <Animated.View
                        style={[
                            styles.glowRing,
                            {
                                borderColor: levelData.color,
                                opacity: glowOpacity,
                            },
                        ]}
                    />
                )}
                <Image
                    source={levelData.badge}
                    style={[
                        styles.badgeImage,
                        !isUnlocked && styles.badgeImageLocked,
                    ]}
                    resizeMode="contain"
                />
                {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={28} color="#fff" />
                    </View>
                )}
            </Animated.View>

            {/* Badge info */}
            <View style={styles.badgeInfo}>
                <Text
                    size={18}
                    weight="bold"
                    color={isUnlocked ? colors.text : colors.muted}
                    style={{ textAlign: 'center', opacity: isUnlocked ? 1 : 0.45 }}
                >
                    {levelData.name}
                </Text>
                <Text
                    size={13}
                    color={isUnlocked ? colors.muted : colors.muted}
                    style={{
                        textAlign: 'center',
                        marginTop: 4,
                        opacity: isUnlocked ? 0.8 : 0.35,
                        paddingHorizontal: 8,
                    }}
                >
                    {isUnlocked ? levelData.description : `Reach ${levelData.pointsRequired} pts to unlock`}
                </Text>

                {/* Progress bar for current level */}
                {isCurrentLevel && nextLevel && (
                    <View style={[styles.progressWrapper, { marginTop: space.md }]}>
                        <View style={[styles.progressTrack, { backgroundColor: `${levelData.color}25` }]}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: levelData.color,
                                        width: `${getProgressToNext(points, index) * 100}%`,
                                    },
                                ]}
                            />
                        </View>
                        <Text size={11} color={colors.muted} style={{ marginTop: 5, textAlign: 'center' }}>
                            {points} / {nextLevel.pointsRequired} pts to{' '}
                            <Text size={11} weight="semibold" color={levelData.color}>
                                {nextLevel.name}
                            </Text>
                        </Text>
                    </View>
                )}

                {isCurrentLevel && !nextLevel && (
                    <View style={[styles.maxLevelBadge, { backgroundColor: `${levelData.color}20`, marginTop: space.md }]}>
                        <Ionicons name="trophy" size={14} color={levelData.color} />
                        <Text size={12} weight="semibold" color={levelData.color} style={{ marginLeft: 5 }}>
                            MAX LEVEL REACHED!
                        </Text>
                    </View>
                )}
            </View>

            {/* Current level crown */}
            {isCurrentLevel && (
                <View style={[styles.currentBadge, { backgroundColor: levelData.color }]}>
                    <Text size={10} weight="bold" color="#fff" style={{ letterSpacing: 0.8 }}>
                        YOU ARE HERE
                    </Text>
                </View>
            )}
        </View>
    );
});

export default observer(function LevelsScreen() {
    const { colors, space } = useTheme();
    const { authStore } = useStores();
    const points = authStore.user?.points ?? 0;
    const currentIdx = getCurrentLevelIndex(points);
    const currentLevel = LEVELS[currentIdx];

    const scrollRef = useRef<ScrollView>(null);

    // Per-badge animated values
    const spinAnims = useRef(LEVELS.map(() => new Animated.Value(0))).current;
    const floatAnims = useRef(LEVELS.map(() => new Animated.Value(0))).current;
    const glowAnims = useRef(LEVELS.map(() => new Animated.Value(0))).current;
    const cardScaleAnims = useRef(LEVELS.map(() => new Animated.Value(0))).current;

    const startCurrentBadgeAnimations = useCallback(() => {
        const spin = spinAnims[currentIdx];
        const float = floatAnims[currentIdx];
        const glow = glowAnims[currentIdx];

        // One-shot spin with easing
        Animated.timing(spin, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
        }).start(() => {
            spin.setValue(0);
            // After spin, start the continuous float + glow loop
            Animated.loop(
                Animated.sequence([
                    Animated.timing(float, {
                        toValue: 1,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(float, {
                        toValue: 0,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glow, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glow, {
                        toValue: 0,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });
    }, [currentIdx, spinAnims, floatAnims, glowAnims]);

    // Stagger all cards appearing, then scroll + animate current badge
    useEffect(() => {
        // Reset all animations
        cardScaleAnims.forEach((a) => a.setValue(0));
        spinAnims.forEach((a) => a.setValue(0));
        floatAnims.forEach((a) => a.setValue(0));
        glowAnims.forEach((a) => a.setValue(0));

        // Stagger card entrance
        const staggerDelay = 80;
        const entranceAnims = cardScaleAnims.map((anim, i) =>
            Animated.timing(anim, {
                toValue: 1,
                duration: 350,
                delay: i * staggerDelay,
                useNativeDriver: true,
            })
        );

        Animated.parallel(entranceAnims).start(() => {
            // After all cards appear, scroll to current badge
            const scrollY =
                HEADER_HEIGHT + currentIdx * (BADGE_CARD_HEIGHT + 16) - 40;
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: scrollY, animated: true });
                setTimeout(() => {
                    startCurrentBadgeAnimations();
                }, 600);
            }, 200);
        });
    }, []);

    const totalItems = Math.floor(points / 5);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: space.lg }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </Pressable>
                <Text weight="bold" size={20}>
                    My Progress
                </Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: space.lg, paddingBottom: 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Points summary */}
                <View
                    style={[
                        styles.summaryCard,
                        {
                            backgroundColor: `${currentLevel.color}15`,
                            borderColor: `${currentLevel.color}40`,
                        },
                    ]}
                >
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text size={28} weight="bold" color={currentLevel.color}>
                                {points}
                            </Text>
                            <Text size={12} color={colors.muted} style={{ marginTop: 2 }}>
                                total points
                            </Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: `${currentLevel.color}30` }]} />
                        <View style={styles.summaryItem}>
                            <Text size={28} weight="bold" color={currentLevel.color}>
                                {totalItems}
                            </Text>
                            <Text size={12} color={colors.muted} style={{ marginTop: 2 }}>
                                items recycled
                            </Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: `${currentLevel.color}30` }]} />
                        <View style={styles.summaryItem}>
                            <Text size={28} weight="bold" color={currentLevel.color}>
                                {currentIdx + 1}
                            </Text>
                            <Text size={12} color={colors.muted} style={{ marginTop: 2 }}>
                                current level
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.summaryLevelName, { borderTopColor: `${currentLevel.color}25` }]}>
                        <Text size={14} weight="semibold" color={currentLevel.color}>
                            {currentLevel.name}
                        </Text>
                    </View>
                </View>

                {/* Badge list */}
                <View style={{ marginTop: space.lg }}>
                    {LEVELS.map((levelData, index) => {
                        const isUnlocked = points >= levelData.pointsRequired;
                        const isCurrentLevel = index === currentIdx;
                        return (
                            <Animated.View
                                key={levelData.level}
                                style={{
                                    marginBottom: 16,
                                    opacity: cardScaleAnims[index],
                                    transform: [
                                        {
                                            translateY: cardScaleAnims[index].interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [30, 0],
                                            }),
                                        },
                                    ],
                                }}
                            >
                                <BadgeCard
                                    levelData={levelData}
                                    index={index}
                                    currentIdx={currentIdx}
                                    points={points}
                                    isCurrentLevel={isCurrentLevel}
                                    isUnlocked={isUnlocked}
                                    spinAnim={spinAnims[index]}
                                    floatAnim={floatAnims[index]}
                                    glowAnim={glowAnims[index]}
                                />
                            </Animated.View>
                        );
                    })}
                </View>

                <Text
                    size={12}
                    color={colors.muted}
                    style={{ textAlign: 'center', opacity: 0.5, marginTop: 8 }}
                >
                    You earn 5 points for every item you recycle
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
});

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
    },
    summaryCard: {
        borderRadius: 20,
        borderWidth: 1.5,
        overflow: 'hidden',
        marginTop: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        marginVertical: 4,
    },
    summaryLevelName: {
        borderTopWidth: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    badgeCard: {
        borderRadius: 24,
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
        minHeight: BADGE_CARD_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
    },
    levelPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 12,
    },
    badgeImageContainer: {
        width: 110,
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    glowRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
    },
    badgeImage: {
        width: 100,
        height: 100,
    },
    badgeImageLocked: {
        opacity: 0.2,
    },
    lockOverlay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    badgeInfo: {
        width: '100%',
        alignItems: 'center',
    },
    progressWrapper: {
        width: '100%',
        paddingHorizontal: 4,
    },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        width: '100%',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    maxLevelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    currentBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomLeftRadius: 16,
        borderTopRightRadius: 22,
    },
});
