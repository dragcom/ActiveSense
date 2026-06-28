import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InfoPage'>;

// InfoPageScreen displays short reusable explanations from Profile and related links.
export default function InfoPageScreen({ navigation, route }: Props) {
  // The caller chooses the icon, but "info" is a safe default.
  const icon = (route.params.icon ?? 'info') as keyof typeof Feather.glyphMap;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Back returns to whichever screen opened this information page. */}
        <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color={colors.primary.teal} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Hero highlights the topic title and matching Feather icon. */}
        <LinearGradient colors={colors.gradient.primary} style={styles.hero}>
          <Feather name={icon} size={34} color="#fff" />
          <Text style={styles.title}>{route.params.title}</Text>
        </LinearGradient>

        {/* Body copy is supplied through route params so this screen stays reusable. */}
        <View style={styles.card}>
          <Text style={styles.body}>{route.params.body}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  content: { padding: 20, paddingBottom: 32 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { color: colors.primary.teal, fontWeight: '700', fontSize: 13 },
  hero: { borderRadius: 24, padding: 24, alignItems: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  card: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },
  body: { color: colors.text.secondary, fontSize: 14, lineHeight: 21 },
});
