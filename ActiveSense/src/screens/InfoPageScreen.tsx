import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InfoPage'>;

export default function InfoPageScreen({ navigation, route }: Props) {
  const icon = (route.params.icon ?? 'info') as keyof typeof Feather.glyphMap;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color={colors.primary.teal} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <LinearGradient colors={colors.gradient.primary} style={styles.hero}>
          <Feather name={icon} size={34} color="#fff" />
          <Text style={styles.title}>{route.params.title}</Text>
        </LinearGradient>

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
