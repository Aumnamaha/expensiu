import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';

interface PremiumAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface PremiumAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: PremiumAlertButton[];
  onClose: () => void;
}

export function PremiumAlert({ visible, title, message, buttons, onClose }: PremiumAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const alertButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', onPress: onClose }];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        
        <Animated.View 
          style={[
            styles.container, 
            { 
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim
            }
          ]}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          
          <View style={styles.buttonRow}>
            {alertButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              
              let textColor = '#6366F1'; // Indigo accent
              if (isCancel) textColor = '#64748b'; // Slate medium
              if (isDestructive) textColor = '#EF4444'; // Red danger

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.button,
                    idx > 0 && styles.buttonBorderLeft,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (btn.onPress) {
                      btn.onPress();
                    } else {
                      onClose();
                    }
                  }}
                >
                  <Text 
                    style={[
                      styles.buttonText, 
                      { color: textColor },
                      !isCancel && { fontWeight: '700' }
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // Sleek dark overlay
  },
  container: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff', // Pure premium white surface
    borderRadius: 20, // Rounded edges (16px - 20px)
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    overflow: 'hidden',
  },
  content: {
    padding: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a', // Slate dark text
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: '#475569', // Medium slate text
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9', // Divider color
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  buttonText: {
    fontSize: 15,
  },
});
