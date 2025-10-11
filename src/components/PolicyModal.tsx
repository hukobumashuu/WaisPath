import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  white: "#FFFFFF",
  softBlue: "#2BA4FF",
  navy: "#08345A",
  slate: "#0F172A",
  muted: "#6B7280",
  lightGray: "#F8FAFC",
};

interface PolicyModalProps {
  visible: boolean;
  initialTab?: "terms" | "privacy";
  onClose: () => void;
  // Optional: pass full text (plain string or JSX) for each document
  termsContent?: React.ReactNode;
  privacyContent?: React.ReactNode;
  termsLastUpdated?: string;
  privacyLastUpdated?: string;
}

export default function PolicyModal({
  visible,
  initialTab = "terms",
  onClose,
  termsContent,
  privacyContent,
  termsLastUpdated = "",
  privacyLastUpdated = "",
}: PolicyModalProps) {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, visible]);

  // Accessibility: announce when modal opens
  useEffect(() => {
    if (visible) {
      const announce = async () => {
        try {
          await AccessibilityInfo.isScreenReaderEnabled();
          AccessibilityInfo.announceForAccessibility(
            `Opened ${
              activeTab === "terms" ? "Terms of Service" : "Privacy Policy"
            }`
          );
        } catch {
          // ignore
        }
      };
      announce();
    }
  }, [visible, activeTab]);

  const defaultTerms = (
    <View>
      <Text style={styles.docHeading}>WAISPATH — Terms of Service</Text>
      {termsLastUpdated ? (
        <Text style={styles.lastUpdated}>Last updated: {termsLastUpdated}</Text>
      ) : null}

      <Text style={styles.paragraph}>
        Welcome to WAISPATH. WAISPATH is a mobile application that provides
        accessibility-aware navigation and community-contributed accessibility
        reports. By using the app you agree to these Terms of Service.
      </Text>

      <Text style={styles.sectionTitle}>Use of the App</Text>
      <Text style={styles.paragraph}>
        Use the app responsibly. Do not submit false or harmful reports. The app
        provides guidance but may not always be accurate.
      </Text>

      <Text style={styles.sectionTitle}>Accounts</Text>
      <Text style={styles.paragraph}>
        Some features require an account. Keep your credentials secure and do
        not share them.
      </Text>

      <Text style={styles.sectionTitle}>Liability & Disclaimers</Text>
      <Text style={styles.paragraph}>
        The app and its content are provided "as is". WAISPATH is not liable for
        injuries, losses, or damages resulting from use of the app.
      </Text>

      <Text style={styles.sectionTitle}>Changes</Text>
      <Text style={styles.paragraph}>
        We may update these Terms. Continued use constitutes acceptance of
        changes.
      </Text>
    </View>
  );

  const defaultPrivacy = (
    <View>
      <Text style={styles.docHeading}>WAISPATH — Privacy Policy</Text>
      {privacyLastUpdated ? (
        <Text style={styles.lastUpdated}>
          Last updated: {privacyLastUpdated}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Information We Collect</Text>
      <Text style={styles.paragraph}>
        We may collect account information (email), location data for
        navigation, and reports you submit about accessibility obstacles.
      </Text>

      <Text style={styles.sectionTitle}>How We Use Information</Text>
      <Text style={styles.paragraph}>
        Data is used to provide navigation, improve accessibility data, and
        respond to support requests. We may use anonymized data for research.
      </Text>

      <Text style={styles.sectionTitle}>Sharing & Disclosure</Text>
      <Text style={styles.paragraph}>
        We do not sell personal data. We may share anonymized data with partners
        to improve accessibility. We may disclose information when required by
        law.
      </Text>

      <Text style={styles.sectionTitle}>Your Rights</Text>
      <Text style={styles.paragraph}>
        You may request access, correction, or deletion of your data by
        contacting support. You can disable location permissions via device
        settings.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      onRequestClose={onClose}
      transparent={true}
      accessible
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View
          style={styles.container}
          accessibilityRole="none"
          accessibilityLabel="Policy dialog"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab("terms")}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === "terms" }}
                style={
                  activeTab === "terms"
                    ? styles.tabButtonActive
                    : styles.tabButton
                }
              >
                <Text
                  style={
                    activeTab === "terms"
                      ? styles.tabTextActive
                      : styles.tabText
                  }
                >
                  Terms
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("privacy")}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === "privacy" }}
                style={
                  activeTab === "privacy"
                    ? styles.tabButtonActive
                    : styles.tabButton
                }
              >
                <Text
                  style={
                    activeTab === "privacy"
                      ? styles.tabTextActive
                      : styles.tabText
                  }
                >
                  Privacy
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close policy modal"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            accessibilityLabel={
              activeTab === "terms"
                ? "Terms of Service content"
                : "Privacy Policy content"
            }
          >
            {activeTab === "terms"
              ? termsContent ?? defaultTerms
              : privacyContent ?? defaultPrivacy}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              style={styles.footerButton}
            >
              <Text style={styles.footerButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  container: {
    height: "82%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: "transparent",
  },
  tabButtonActive: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: COLORS.lightGray,
  },
  tabText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: "600",
  },
  tabTextActive: {
    color: COLORS.slate,
    fontSize: 15,
    fontWeight: "700",
  },
  closeButton: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 20,
  },
  contentInner: {
    paddingVertical: 18,
  },
  docHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.slate,
    marginBottom: 6,
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.slate,
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
  },
  footerButton: {
    backgroundColor: COLORS.softBlue,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  footerButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
