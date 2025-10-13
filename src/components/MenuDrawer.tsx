import { useStores } from '@/src/providers/StoreProvider';
import { useTheme } from '@/src/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { observer } from 'mobx-react-lite';
import React, { useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const drawerWidth = screenWidth * 0.8; // 80% of screen width

export const MenuDrawer = observer(({ isOpen, onClose }: MenuDrawerProps) => {
  const { colors, space } = useTheme();
  const { authStore } = useStores();
  const insets = useSafeAreaInsets();
  
  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isOpen) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -drawerWidth,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const handleLogout = () => {
    authStore.logout();
    onClose();
    router.replace('/(auth)');
  };

  return (
    <>
      {/* Backdrop */}
      <Animated.View 
        style={[
          styles.backdrop, 
          { 
            opacity: backdropAnim,
            backgroundColor: 'rgba(0,0,0,0.5)' 
          }
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable 
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
        />
      </Animated.View>
      
      {/* Drawer */}
      <Animated.View 
        style={[
          styles.drawer, 
          { 
            backgroundColor: colors.bg,
            paddingTop: insets.top,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        {/* Profile Section */}
        <View style={[styles.profileSection, { paddingHorizontal: space.lg }]}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: colors.text }]}>
            <Text style={[styles.avatarText, { color: colors.bg }]}>
              {authStore.user?.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          
          {/* Email */}
          <Text style={[styles.email, { color: colors.text, marginTop: space.md }]}>
            {authStore.user?.email || 'user@example.com'}
          </Text>
          
          {/* Points */}
          <Text style={[styles.points, { color: colors.text, marginTop: space.sm }]}>
            Points: 5
          </Text>
        </View>

        {/* Menu Items */}
        <View style={[styles.menuItems, { paddingHorizontal: space.lg, marginTop: space.xl }]}>
          <Pressable style={styles.menuItem} onPress={() => console.log('Community pressed')}>
            <Ionicons name="globe-outline" size={24} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Community</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => console.log('My Council pressed')}>
            <Ionicons name="location-outline" size={24} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>My Council</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => console.log('About Pod pressed')}>
            <Ionicons name="information-circle-outline" size={24} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>About Pod</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Logout */}
        <View style={[styles.logoutSection, { paddingHorizontal: space.lg, paddingBottom: space.xl }]}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={[styles.logoutText, { color: colors.text }]}>Log out</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: drawerWidth,
    zIndex: 999,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
    textAlign: 'center',
  },
  points: {
    fontSize: 18,
    fontWeight: '600',
  },
  menuItems: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
  },
  logoutSection: {
    alignItems: 'center',
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
