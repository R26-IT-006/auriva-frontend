import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

// The card is sized against the window rather than given fixed dimensions, so a
// tall drawing on a small phone still leaves the header and the button on screen.
const MAX_CARD_WIDTH  = 400;
const SIDE_MARGIN     = Layout.spacing.lg * 2;
const IMAGE_HEIGHT_PCT = 0.42;
const IMAGE_MAX_HEIGHT = 340;

/**
 * A closer look at one drawing, as a dialog over the report.
 *
 * Deliberately not full-screen: a teacher opens these while reading a day's
 * card, and taking over the whole screen loses their place in a long report for
 * something they look at for two seconds. A panel that sits over the page keeps
 * the context underneath it, and the thumbnail it came from is 72px — this is
 * already several times larger, which is all "let me see it properly" needs.
 */
export function ImageViewerModal({
  visible,
  uri,
  title,
  subtitle,
  onClose,
  // Taken as a pair, because they are one in the theme: a `button` colour with
  // the wrong `buttonText` on it is unreadable on the lighter avatars.
  accent = Colors.primary,
  accentText = '#FFFFFF',
}) {
  const { width, height } = useWindowDimensions();
  const [status, setStatus] = useState('loading'); // loading | ready | failed
  const [failedToOpen, setFailedToOpen] = useState(false);

  // Keyed on the uri, not on `visible`: opening a second drawing reuses the same
  // mounted modal, and without this it would inherit the first one's `ready` and
  // paint a blank frame while the new image loads.
  useEffect(() => {
    setStatus('loading');
    setFailedToOpen(false);
  }, [uri]);

  const cardWidth   = Math.min(width - SIDE_MARGIN, MAX_CARD_WIDTH);
  const imageHeight = Math.min(height * IMAGE_HEIGHT_PCT, IMAGE_MAX_HEIGHT);

  /**
   * Hands the drawing to the browser, which is where saving an image lives on
   * both platforms.
   *
   * Writing straight into the camera roll needs `expo-media-library`, a native
   * module that is not in this build — adding it means a new dev build, so it is
   * the project's call rather than something to slip in behind a button. If it
   * is added later, this is the only function that has to change.
   */
  const download = async () => {
    if (!uri) return;
    setFailedToOpen(false);
    try {
      const supported = await Linking.canOpenURL(uri);
      if (!supported) throw new Error('unsupported url');
      await Linking.openURL(uri);
    } catch {
      setFailedToOpen(true);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}   // Android hardware back
    >
      {/* Tapping the dimmed area closes; the inner Pressable is what stops that
          press from firing when the card itself is tapped. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => {}}>

          <View style={styles.head}>
            <View style={styles.headText}>
              {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Tinted ground behind the image: a drawing is mostly white paper, and
              on a white card its edges would simply disappear. */}
          <View style={[styles.stage, { height: imageHeight }]}>
            {uri ? (
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
                onLoad={() => setStatus('ready')}
                onError={() => setStatus('failed')}
                accessibilityLabel={title ? `Drawing of ${title}` : 'Drawing'}
              />
            ) : null}

            {status === 'loading' ? (
              <View style={styles.overlay} pointerEvents="none">
                <ActivityIndicator color={accent} />
              </View>
            ) : null}

            {status === 'failed' ? (
              <View style={styles.overlay}>
                <Ionicons name="cloud-offline-outline" size={24} color={Colors.icon.muted} />
                <Text style={styles.overlayText}>Couldn't load this drawing.</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            {failedToOpen ? (
              <Text style={styles.error}>Couldn't open the drawing. Check the connection.</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                { backgroundColor: accent },
                status === 'failed' && styles.downloadBtnDisabled,
              ]}
              onPress={download}
              disabled={status === 'failed'}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Download this drawing"
            >
              <Ionicons name="download-outline" size={17} color={accentText} />
              <Text style={[styles.downloadText, { color: accentText }]}>Download</Text>
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.lg,
    backgroundColor: 'rgba(16,20,34,0.55)',
  },
  card: {
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Layout.shadow.lg,
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingLeft: Layout.spacing.md,
    paddingRight: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm + 2,
  },
  headText: { flex: 1 },
  title: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
  },
  subtitle: {
    marginTop: 1,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
  },

  stage: {
    backgroundColor: Colors.surfaceAlt,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overlayText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
  },

  footer: {
    padding: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  error: {
    fontSize: Layout.fontSize.xs,
    color: Colors.status.error,
    textAlign: 'center',
  },
  // backgroundColor and text colour come from the avatar theme at the call site.
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm + 4,
    borderRadius: Layout.radius.full,
  },
  downloadBtnDisabled: { opacity: 0.4 },
  downloadText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
  },
});
