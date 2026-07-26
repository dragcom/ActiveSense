import React, { useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: '1',
    question: 'How does the camera pose detection work?',
    answer:
      'ActiveSense uses real-time AI models directly on your device to map body joints. Video streams are processed locally and never uploaded to external servers.',
  },
  {
    id: '2',
    question: 'Why is my avatar not syncing with my movement?',
    answer:
      'Ensure your camera lens is clean and your full body is visible in a well-lit environment. Avoid loose or baggy clothing for higher tracking accuracy.',
  },
  {
    id: '3',
    question: 'How far away should I place my phone for tracking?',
    answer:
      'Position your device 6 to 8 feet away at waist height so your entire body (head to toe) remains visible in the frame. Tilt your phone slightly downward for floor exercises like push-ups or planks.',
  },
];

export default function HelpSupportScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  // Helper function to safely open external URLs
  const handleOpenURL = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', `Cannot open URL: ${url}`);
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact Support Channels */}
        <Text style={styles.sectionHeader}>GET IN TOUCH</Text>
        <View style={styles.supportGrid}>
          {/* Card 1: Report Bug via GitHub Issues */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.supportCard}
            onPress={() =>
              handleOpenURL('https://github.com/dragcom/ActiveSense/issues/new')
            }
          >
            <View style={styles.iconCircle}>
              <Feather name="github" size={20} color={colors.primary.teal} />
            </View>
            <Text style={styles.supportTitle}>Report Bug</Text>
            <Text style={styles.supportSub}>GitHub Issues</Text>
          </TouchableOpacity>

          {/* Card 2: User Guide / Documentation */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.supportCard}
            onPress={() =>
              handleOpenURL('https://github.com/dragcom/ActiveSense#readme')
            }
          >
            <View style={styles.iconCircle}>
              <Feather name="book-open" size={20} color={colors.primary.teal} />
            </View>
            <Text style={styles.supportTitle}>User Guide</Text>
            <Text style={styles.supportSub}>Documentation</Text>
          </TouchableOpacity>
        </View>

        {/* Accordion FAQ Section */}
        <Text style={styles.sectionHeader}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={styles.faqCard}>
          {FAQS.map((item, index) => {
            const isExpanded = expandedId === item.id;
            return (
              <View key={item.id}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.faqHeader}
                  onPress={() => toggleFAQ(item.id)}
                >
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}

                {index < FAQS.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  content: { padding: 16, gap: 16 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    marginLeft: 4,
  },
  supportGrid: { flexDirection: 'row', gap: 12 },
  supportCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  supportTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  supportSub: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  faqCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 13,
    color: colors.text.secondary,
    paddingBottom: 12,
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
});