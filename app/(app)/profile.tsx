import { Button } from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { binSystemsForCouncil } from '@/src/services/api/binsystems/binsystemforcouncil';
import { councilsForPostCode } from '@/src/services/api/councils/councilsforpostcode';
import { BinSystem } from '@/src/services/api/types/binsystem';
import { Council } from '@/src/services/api/types/council';
import { PodConfiguration } from '@/src/services/api/types/user';
import { updateUser } from '@/src/services/api/user/updateuser';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageSourcePropType,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

const BIN_IMAGES: Record<string, ImageSourcePropType> = {
    'Green': require('@/assets/images/bins/bin-darkgreen.png'),
    'Lime Green': require('@/assets/images/bins/bin-lightgreen.png'),
    'Blue': require('@/assets/images/bins/bin-blue.png'),
    'Red': require('@/assets/images/bins/bin-red.png'),
    'Yellow': require('@/assets/images/bins/bin-yellow.png'),
    'Purple': require('@/assets/images/bins/bin-purple.png'),
    'Maroon': require('@/assets/images/bins/bin-maroon.png'),
    'No Bin System': require('@/assets/images/bins/no-bins-ic.svg'),
};

const POD_OPTIONS: { key: PodConfiguration; label: string; image?: ImageSourcePropType }[] = [
    {
        key: 'freestanding',
        label: 'Freestanding',
        image: require('@/assets/images/pod_bins/freestanding_top_open.png'),
    },
    {
        key: 'in_drawer',
        label: 'In Drawer',
        image: require('@/assets/images/pod_bins/drawer.png'),
    },
    {
        key: 'under_sink',
        label: 'Under Sink',
        image: require('@/assets/images/pod_bins/undersink.png'),
    },
    {
        key: 'none',
        label: 'No pod',
    },
];

type EditingSection = 'council' | 'binsystem' | 'pod' | null;

export default observer(function ProfileScreen() {
    const { colors, space } = useTheme();
    const { authStore } = useStores();
    const user = authStore.user;

    const [editingSection, setEditingSection] = useState<EditingSection>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Council lookup state
    const [postcode, setPostcode] = useState('');
    const [councils, setCouncils] = useState<Council[]>([]);
    const [councilLoading, setCouncilLoading] = useState(false);
    const [selectedCouncilId, setSelectedCouncilId] = useState<string | null>(null);

    // Bin system state
    const [binSystems, setBinSystems] = useState<BinSystem[]>([]);
    const [binSystemLoading, setBinSystemLoading] = useState(false);
    const [selectedBinSystemId, setSelectedBinSystemId] = useState<string | null>(null);

    // Pod config state
    const [selectedPodConfig, setSelectedPodConfig] = useState<PodConfiguration>(
        user?.pod_configuration || 'none'
    );

    const resetEditState = () => {
        setEditingSection(null);
        setError(null);
        setPostcode('');
        setCouncils([]);
        setSelectedCouncilId(null);
        setBinSystems([]);
        setSelectedBinSystemId(null);
        setSelectedPodConfig(user?.pod_configuration || 'none');
    };

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleLookupCouncils = async () => {
        if (!/^\d{4}$/.test(postcode.trim())) {
            setError('Please enter a valid 4-digit postcode.');
            return;
        }
        setError(null);
        setCouncilLoading(true);
        try {
            const res = await councilsForPostCode(postcode.trim());
            setCouncils(res.councils);
            if (res.councils.length === 0) {
                setError('No councils found for this postcode.');
            }
        } catch {
            setError('Failed to look up councils.');
        } finally {
            setCouncilLoading(false);
        }
    };

    const handleSelectCouncil = async (councilId: string) => {
        setSelectedCouncilId(councilId);
        setBinSystemLoading(true);
        setBinSystems([]);
        setSelectedBinSystemId(null);
        try {
            const res = await binSystemsForCouncil(councilId);
            setBinSystems(res.bin_systems);
            if (res.bin_systems.length > 0) {
                setSelectedBinSystemId(res.bin_systems[0].id);
            }
        } catch {
            setError('Failed to look up bin systems.');
        } finally {
            setBinSystemLoading(false);
        }
    };

    const handleSaveCouncilAndBinSystem = async () => {
        if (!selectedCouncilId || !selectedBinSystemId) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateUser({
                council_id: selectedCouncilId,
                bin_system_id: selectedBinSystemId,
            });
            authStore.user = updated;
            resetEditState();
            showSuccess('Council and bin system updated.');
        } catch {
            setError('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePodConfig = async () => {
        setSaving(true);
        setError(null);
        try {
            const updated = await updateUser({
                pod_configuration: selectedPodConfig,
            });
            authStore.user = updated;
            resetEditState();
            showSuccess('pod configuration updated.');
        } catch {
            setError('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const podLabel = (config: PodConfiguration) => {
        switch (config) {
            case 'freestanding': return 'Freestanding';
            case 'in_drawer': return 'In Drawer';
            case 'under_sink': return 'Under Sink';
            default: return 'None';
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: space.lg }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </Pressable>
                <Text weight="semibold" size={20}>Profile</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { padding: space.lg }]}>
                {/* Success Message */}
                {successMessage && (
                    <View style={[styles.successBanner, { marginBottom: space.md }]}>
                        <Text size={14} color="#166534">{successMessage}</Text>
                    </View>
                )}

                {/* Email (read-only) */}
                <View style={[styles.section, { borderColor: colors.muted }]}>
                    <Text weight="semibold" size={14} color={colors.muted}>Email</Text>
                    <Text size={16} style={{ marginTop: 4 }}>{user?.email}</Text>
                </View>

                {/* Council & Bin System */}
                <View style={[styles.section, { borderColor: colors.muted }]}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text weight="semibold" size={14} color={colors.muted}>Council</Text>
                            <Text size={16} style={{ marginTop: 4 }}>{user?.council?.name || 'Not set'}</Text>
                        </View>
                        {editingSection !== 'council' && (
                            <Pressable onPress={() => { resetEditState(); setEditingSection('council'); }}>
                                <Text size={14} color={colors.primary}>Change</Text>
                            </Pressable>
                        )}
                    </View>

                    {user?.bin_system && editingSection !== 'council' && (
                        <View style={{ marginTop: space.md }}>
                            <Text weight="semibold" size={14} color={colors.muted}>Bin System</Text>
                            <View style={styles.currentBinsRow}>
                                {user.bin_system.bins.map((bin) => (
                                    <View key={bin.id} style={styles.currentBinItem}>
                                        <Image
                                            source={BIN_IMAGES[bin.appearance] || BIN_IMAGES['No Bin System']}
                                            style={styles.currentBinImage}
                                            resizeMode="contain"
                                        />
                                        <Text size={11} color={colors.muted} numberOfLines={2} style={{ textAlign: 'center' }}>
                                            {bin.type}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {editingSection === 'council' && (
                        <View style={{ marginTop: space.md }}>
                            <Text size={14} color={colors.muted} style={{ marginBottom: space.sm }}>
                                Enter your postcode to find your council:
                            </Text>
                            <TextInput
                                style={[styles.input, { borderColor: colors.muted, color: colors.text }]}
                                placeholder="Postcode"
                                placeholderTextColor={colors.muted}
                                value={postcode}
                                onChangeText={setPostcode}
                                keyboardType="number-pad"
                                maxLength={4}
                            />
                            <Pressable
                                style={[styles.smallButton, { backgroundColor: colors.primary, marginTop: space.sm, opacity: councilLoading ? 0.5 : 1 }]}
                                onPress={handleLookupCouncils}
                                disabled={councilLoading}
                            >
                                <Text size={14} color={colors.onPrimary} weight="semibold">
                                    {councilLoading ? 'Looking up...' : 'Look up councils'}
                                </Text>
                            </Pressable>

                            {councils.length > 0 && (
                                <View style={{ marginTop: space.md }}>
                                    <Text weight="semibold" size={14} color={colors.muted} style={{ marginBottom: space.sm }}>
                                        Select your council:
                                    </Text>
                                    {councils.map((council) => (
                                        <Pressable
                                            key={council.id}
                                            style={[
                                                styles.selectableItem,
                                                {
                                                    borderColor: selectedCouncilId === council.id ? colors.primary : colors.muted,
                                                    borderWidth: selectedCouncilId === council.id ? 2 : 1,
                                                }
                                            ]}
                                            onPress={() => handleSelectCouncil(council.id)}
                                        >
                                            <Text size={16}>{council.name}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}

                            {binSystemLoading && (
                                <ActivityIndicator style={{ marginTop: space.md }} color={colors.primary} />
                            )}

                            {binSystems.length > 0 && (
                                <View style={{ marginTop: space.md }}>
                                    <Text weight="semibold" size={14} color={colors.muted} style={{ marginBottom: space.sm }}>
                                        Select your bin system:
                                    </Text>
                                    {binSystems.map((bs) => (
                                        <Pressable
                                            key={bs.id}
                                            style={[
                                                styles.selectableItem,
                                                {
                                                    borderColor: selectedBinSystemId === bs.id ? colors.primary : colors.muted,
                                                    borderWidth: selectedBinSystemId === bs.id ? 2 : 1,
                                                }
                                            ]}
                                            onPress={() => setSelectedBinSystemId(bs.id)}
                                        >
                                            <View style={styles.binsRow}>
                                                {bs.bins.map((bin) => (
                                                    <View key={bin.id} style={styles.binItem}>
                                                        <Image
                                                            source={BIN_IMAGES[bin.appearance] || BIN_IMAGES['No Bin System']}
                                                            style={styles.binImage}
                                                            resizeMode="contain"
                                                        />
                                                        <Text size={10} color={colors.muted} numberOfLines={2} style={{ textAlign: 'center' }}>
                                                            {bin.type}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            )}

                            {selectedCouncilId && selectedBinSystemId && (
                                <Pressable
                                    style={[styles.smallButton, { backgroundColor: colors.primary, marginTop: space.md, opacity: saving ? 0.5 : 1 }]}
                                    onPress={handleSaveCouncilAndBinSystem}
                                    disabled={saving}
                                >
                                    <Text size={14} color={colors.onPrimary} weight="semibold">
                                        {saving ? 'Saving...' : 'Save'}
                                    </Text>
                                </Pressable>
                            )}

                            <Pressable
                                style={[styles.smallButton, { backgroundColor: 'transparent', marginTop: space.sm }]}
                                onPress={resetEditState}
                            >
                                <Text size={14} color={colors.muted}>Cancel</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Pod Configuration */}
                <View style={[styles.section, { borderColor: colors.muted }]}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text weight="semibold" size={14} color={colors.muted}>pod Configuration</Text>
                            <Text size={16} style={{ marginTop: 4 }}>{podLabel(user?.pod_configuration || 'none')}</Text>
                        </View>
                        {editingSection !== 'pod' && (
                            <Pressable onPress={() => { resetEditState(); setEditingSection('pod'); }}>
                                <Text size={14} color={colors.primary}>Change</Text>
                            </Pressable>
                        )}
                    </View>

                    {editingSection === 'pod' && (
                        <View style={{ marginTop: space.md }}>
                            {POD_OPTIONS.map((option) => {
                                const isSelected = selectedPodConfig === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        style={[
                                            styles.podOption,
                                            {
                                                borderColor: isSelected ? colors.primary : colors.muted,
                                                borderWidth: isSelected ? 2 : 1,
                                                backgroundColor: colors.bg,
                                            }
                                        ]}
                                        onPress={() => setSelectedPodConfig(option.key)}
                                    >
                                        {option.image && (
                                            <Image
                                                source={option.image}
                                                style={styles.podOptionImage}
                                                resizeMode="contain"
                                            />
                                        )}
                                        <Text weight="semibold" size={16} style={{ textAlign: 'center' }}>
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}

                            <Pressable
                                style={[styles.smallButton, { backgroundColor: colors.primary, marginTop: space.md, opacity: saving ? 0.5 : 1 }]}
                                onPress={handleSavePodConfig}
                                disabled={saving}
                            >
                                <Text size={14} color={colors.onPrimary} weight="semibold">
                                    {saving ? 'Saving...' : 'Save'}
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[styles.smallButton, { backgroundColor: 'transparent', marginTop: space.sm }]}
                                onPress={resetEditState}
                            >
                                <Text size={14} color={colors.muted}>Cancel</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Points */}
                <View style={[styles.section, { borderColor: colors.muted }]}>
                    <Text weight="semibold" size={14} color={colors.muted}>Points</Text>
                    <Text size={16} style={{ marginTop: 4 }}>{user?.points ?? 0}</Text>
                </View>

                {error && (
                    <View style={[styles.errorBanner, { marginTop: space.md }]}>
                        <Text size={14} color="#DC2626">{error}</Text>
                    </View>
                )}
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
    section: {
        borderBottomWidth: 0.5,
        paddingVertical: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    currentBinsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    currentBinItem: {
        alignItems: 'center',
        width: 50,
    },
    currentBinImage: {
        width: 36,
        height: 48,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    smallButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    selectableItem: {
        padding: 14,
        borderRadius: 10,
        marginBottom: 8,
    },
    binsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    binItem: {
        alignItems: 'center',
        width: 50,
    },
    binImage: {
        width: 36,
        height: 48,
        marginBottom: 4,
    },
    podOption: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    podOptionImage: {
        width: '100%',
        height: 140,
        marginBottom: 8,
    },
    successBanner: {
        backgroundColor: '#DCFCE7',
        padding: 12,
        borderRadius: 8,
    },
    errorBanner: {
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
    },
});
