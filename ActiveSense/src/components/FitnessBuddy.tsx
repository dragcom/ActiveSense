import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserStats } from '../types';

interface SaiyanForm {
  formName: string;
  imageSource: ImageSourcePropType;
  auraColor: string;
  secondaryColor: string;
  gradientColors: [string, string];
  quotes: string[];
}

const getSaiyanForm = (level: number): SaiyanForm => {
  if (level < 2) {
    return {
      formName: 'Baby Saiyan',
      imageSource: require('../../assets/saiyans/baby_goku.png'),
      auraColor: '#38BDF8',
      secondaryColor: '#0284C7',
      gradientColors: ['#0C4A6E', '#0F172A'],
      quotes: [`"Waaah! Ki power level is small, but growing! 👶"`],
    };
  }
  if (level < 4) {
    return {
      formName: 'Kid Goku',
      imageSource: require('../../assets/saiyans/kid_goku.png'),
      auraColor: '#F97316',
      secondaryColor: '#EA580C',
      gradientColors: ['#431407', '#0F172A'],
      quotes: [`"Flying Nimbus! Time to hit the gym! ☁️"`],
    };
  }
  if (level < 6) {
    return {
      formName: 'Base Adult Goku',
      imageSource: require('../../assets/saiyans/adult_goku.png'),
      auraColor: '#2563EB',
      secondaryColor: '#1D4ED8',
      gradientColors: ['#1E3A8A', '#0F172A'],
      quotes: [`"Training hard every day! Surpass your limits! 💪"`],
    };
  }
  if (level < 8) {
    return {
      formName: 'Super Saiyan',
      imageSource: require('../../assets/saiyans/super_saiyan_goku.png'),
      auraColor: '#EAB308',
      secondaryColor: '#FACC15',
      gradientColors: ['#382C05', '#0F172A'],
      quotes: [`"AND THIS... IS TO GO EVEN FURTHER BEYOND! ⚡"`],
    };
  }
  return {
    formName: 'Ultra Instinct Deity',
    imageSource: require('../../assets/saiyans/ultra_saiyan_goku.png'),
    auraColor: '#A855F7',
    secondaryColor: '#E2E8F0',
    gradientColors: ['#28103F', '#0F172A'],
    quotes: [`"True mastery of mind, body, and fitness! ✨"`],
  };
};

// --- MAIN FITNESS BUDDY ---
export default function FitnessBuddy({ stats }: { stats: UserStats }) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  const kiPerLevel = 200;
  const level = Math.floor(stats.healthpoints / kiPerLevel) + 1;
  const currentKi = stats.healthpoints % kiPerLevel;
  const kiProgress = Math.min((currentKi / kiPerLevel) * 100, 100);

  const saiyan = getSaiyanForm(level);

  const dialogueList = [
    stats.streakDays > 0
      ? `"Streak: ${stats.streakDays} days! Keep charging your Ki! 🔥"`
      : saiyan.quotes[0],
    ...saiyan.quotes,
  ];

  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handleChargeUp = () => {
    setQuoteIndex((prev) => (prev + 1) % dialogueList.length);

    floatAnim.setValue(0);
    opacityAnim.setValue(1);
    Animated.parallel([
      Animated.timing(floatAnim, {
        toValue: -35,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={buddyStyles.cardContainer}>
      <LinearGradient
        colors={saiyan.gradientColors}
        style={buddyStyles.cardGradient}
      >
        <View style={buddyStyles.contentColumn}>
          {/* Top Centered Avatar Viewport Box */}
          <View style={buddyStyles.avatarWrapper}>
            <Animated.Text
              style={[
                buddyStyles.floatingKi,
                {
                  opacity: opacityAnim,
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              💥
            </Animated.Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleChargeUp}
              style={[
                buddyStyles.canvasViewport,
                { borderColor: saiyan.auraColor },
              ]}
            >
              {/* Aura Glow Background */}
              <View
                style={[
                  buddyStyles.auraGlowBg,
                  { backgroundColor: saiyan.auraColor },
                ]}
              />

              {/* Character Render Image */}
              <Image
                source={saiyan.imageSource}
                style={buddyStyles.characterImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Level Tag */}
            <View
              style={[
                buddyStyles.levelTag,
                { backgroundColor: saiyan.auraColor },
              ]}
            >
              <Text style={buddyStyles.levelText}>Lvl {level}</Text>
            </View>
          </View>

          {/* Bottom Section: Info & Dialogue */}
          <View style={buddyStyles.infoContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleChargeUp}
              style={buddyStyles.speechBubble}
            >
              {/* Pointer arrow pointing up toward character */}
              <View style={buddyStyles.speechArrowTop} />

              <Text style={[buddyStyles.formName, { color: saiyan.auraColor }]}>
                {saiyan.formName}
              </Text>
              <Text style={buddyStyles.speechText}>
                {dialogueList[quoteIndex]}
              </Text>
            </TouchableOpacity>

            {/* Ki Progress Bar */}
            <View style={buddyStyles.kiContainer}>
              <View style={buddyStyles.kiRow}>
                <Text style={buddyStyles.kiLabel}>Ki Power Level</Text>
                <Text style={[buddyStyles.kiValue, { color: saiyan.auraColor }]}>
                  {currentKi}/{kiPerLevel} Ki
                </Text>
              </View>
              <View style={buddyStyles.kiTrack}>
                <LinearGradient
                  colors={[saiyan.auraColor, saiyan.secondaryColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[buddyStyles.kiFill, { width: `${kiProgress}%` }]}
                />
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const buddyStyles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  contentColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },
  avatarWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  floatingKi: {
    position: 'absolute',
    top: -14,
    fontSize: 26,
    zIndex: 10,
  },
  canvasViewport: {
    width: 180,
    height: 190,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  auraGlowBg: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.3,
    transform: [{ scale: 1.5 }],
  },

  characterImage: {
    width: 160,
    height: 160,
    zIndex: 2,
  },
  levelTag: {
    position: 'absolute',
    bottom: -10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
    zIndex: 5,
  },
  levelText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  speechBubble: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    position: 'relative',
  },
  formName: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  speechText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  speechArrowTop: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
    borderRightWidth: 6,
    borderRightColor: 'transparent',
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  kiContainer: {
    width: '100%',
    gap: 6,
  },
  kiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kiLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kiValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  kiTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  kiFill: {
    height: '100%',
    borderRadius: 9999,
  },
});