// src/components/InfoModal.tsx
import React, { useEffect } from "react";
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
  success: "#10B981",
  pasigGreen: "#0B6E4F",
  pasigGreenLight: "#E8F6EF",
  pasigBlue: "#0B66C2",
  pasigBlueLight: "#EAF4FF",
};

interface InfoModalProps {
  visible: boolean;
  type: "about" | "team";
  onClose: () => void;
}

export default function InfoModal({ visible, type, onClose }: InfoModalProps) {
  useEffect(() => {
    if (visible) {
      const announce = async () => {
        try {
          await AccessibilityInfo.isScreenReaderEnabled();
          AccessibilityInfo.announceForAccessibility(
            type === "team" ? "Opened Meet the Team" : "Opened About WAISPATH"
          );
        } catch {
          // ignore
        }
      };
      announce();
    }
  }, [visible, type]);

  const renderTeam = () => (
    <View>
      <Text style={styles.docHeading}>Meet the Team</Text>
      <Text style={styles.lastUpdated}>
        Pamantasan ng Lungsod ng Maynila - College of Information Systems and
        Technology Management
      </Text>

      <Text style={styles.sectionTitle}>Developers & Contributors</Text>

      {/* Matthew - Green card */}
      <View style={[styles.card, { backgroundColor: COLORS.pasigGreenLight }]}>
        <View style={getCardLeftAccentStyle(COLORS.pasigGreen)} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardName, { color: COLORS.pasigGreen }]}>
            Matthew Jacob B. Insigne
          </Text>
          <Text style={styles.cardRole}>
            Software Developer & Documentation
          </Text>
          <Text style={styles.cardEmail}>mjbinsigne2022@plm.edu.ph</Text>
        </View>
      </View>

      {/* Artha - Blue card */}
      <View style={[styles.card, { backgroundColor: COLORS.pasigBlueLight }]}>
        <View style={getCardLeftAccentStyle(COLORS.pasigBlue)} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardName, { color: COLORS.pasigBlue }]}>
            Artha Bernice A. Delgado
          </Text>
          <Text style={styles.cardRole}>
            Business Analyst & Documentation Lead
          </Text>
          <Text style={styles.cardEmail}>abadelgado2022@plm.edu.ph</Text>
        </View>
      </View>

      <Text style={styles.smallNote}>
        Thank you to our instructors, testers, and community contributors who
        supported this capstone project.
      </Text>
    </View>
  );

  const renderAbout = () => (
    <View>
      <Text style={styles.docHeading}>About WAISPATH</Text>
      <Text style={styles.lastUpdated}>Last updated: October 11, 2025</Text>

      <Text style={styles.paragraph}>
        WAISPATH helps people with reduced mobility navigate the city more
        safely and independently. We combine community-submitted obstacle
        reports, GPS routing, and accessibility data so users can choose paths
        that match their needs.
      </Text>

      <Text style={styles.sectionTitle}>What We Do</Text>
      <Text style={styles.bullet}>
        • Community reporting of obstacles (blocked sidewalks, missing ramps)
      </Text>
      <Text style={styles.bullet}>
        • Accessibility-aware route guidance using GPS and mapping
      </Text>
      <Text style={styles.bullet}>
        • Aggregated, anonymized data used to help improve city accessibility
      </Text>

      <Text style={styles.sectionTitle}>How We Use Data</Text>
      <Text style={styles.paragraph}>
        We collect basic account information and location/report data to provide
        navigation and improve accessibility mapping. We do not sell personal
        data; anonymized data may be shared with partners for research and city
        planning.
      </Text>

      <Text style={styles.sectionTitle}>Get Involved</Text>
      <Text style={styles.paragraph}>
        You can contribute by submitting reports in-app, testing routes, or
        sharing feedback. For support, contact the team through the Meet the
        Team section.
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>
                {type === "team" ? "Meet the Team" : "About WAISPATH"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {type === "team"
                  ? "Students & contributors behind this project"
                  : "Learn more about WAISPATH and our mission"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
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
              type === "team" ? "Meet the Team content" : "About content"
            }
          >
            {type === "team" ? renderTeam() : renderAbout()}
            <View style={{ height: 36 }} />
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

/** Helper: return a left-accent style object for the colored bar */
function getCardLeftAccentStyle(color: string) {
  return {
    width: 6,
    height: "100%",
    backgroundColor: color,
    borderRadius: 4,
    marginRight: 12,
  } as const;
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.slate,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
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
    color: COLORS.pasigGreen,
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
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 20,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 20,
    marginBottom: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardRole: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  cardEmail: {
    fontSize: 13,
    color: COLORS.muted,
  },
  smallNote: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
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
