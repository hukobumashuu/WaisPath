import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface HomeScreenProps {
  navigation: any; // Simple typing for now - we'll fix this in Month 2
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  return (
    <ScrollView style={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>WAISPATH</Text>
        <Text style={styles.heroSubtitle}>
          Accessible navigation para sa Pasig City
        </Text>
        <Text style={styles.heroDescription}>
          Handog namin ang ligtas at accessible na routes para sa mga PWD
        </Text>
      </View>

      <View style={styles.content}>
        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Ano ang kailangan mo?</Text>

        {/* Primary Action - Find Route */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => navigation.navigate("Navigate")}
          accessibilityLabel="Maghanap ng accessible route"
          accessibilityHint="Mag-navigate sa route finder screen"
        >
          <Ionicons name="navigate-circle" size={32} color="white" />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Maghanap ng Route</Text>
            <Text style={styles.actionSubtitle}>Accessible paths sa Pasig</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>

        {/* Secondary Action - Report Problem */}
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => navigation.navigate("Report")}
          accessibilityLabel="Mag-report ng obstacle"
          accessibilityHint="I-report ang mga hadlang sa daan"
        >
          <Ionicons name="alert-circle" size={32} color="white" />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>I-report ang Hadlang</Text>
            <Text style={styles.actionSubtitle}>
              Tulungang i-improve ang accessibility
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>

        {/* Status Cards */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Status ng Sistema</Text>

          {/* Community Reports */}
          <View style={[styles.statusCard, styles.grayCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="people" size={20} color="#6B7280" />
              <Text style={styles.cardTitle}>Community Reports</Text>
            </View>
            <Text style={styles.cardText}>
              Mga bagong report sa loob ng 24 oras:{" "}
              <Text style={styles.boldText}>12</Text>
            </Text>
          </View>

          {/* System Health */}
          <View style={[styles.statusCard, styles.greenCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.cardTitle}>System Status</Text>
            </View>
            <Text style={styles.cardText}>
              Lahat ng serbisyo:{" "}
              <Text style={[styles.boldText, { color: "#059669" }]}>
                Normal
              </Text>
            </Text>
          </View>
        </View>

        {/* Quick Tips */}
        <View style={styles.tipCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb" size={24} color="#1E40AF" />
            <Text style={[styles.cardTitle, { color: "#1E40AF" }]}>
              Tip para sa Araw
            </Text>
          </View>
          <Text style={styles.tipText}>
            Mag-report ng mga vendor na tumutubo sa sidewalk. Mas madaming
            report, mas accurate ang aming routes para sa lahat ng PWD.
          </Text>
        </View>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>
            WAISPATH v1.0 • Para sa Pasig City PWD Community
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: "#3B82F6",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#DBEAFE",
    marginBottom: 16,
  },
  heroDescription: {
    fontSize: 16,
    color: "#DBEAFE",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 24,
  },
  actionButton: {
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
  },
  primaryAction: {
    backgroundColor: "#22C55E",
  },
  secondaryAction: {
    backgroundColor: "#F59E0B",
    marginBottom: 24,
  },
  actionContent: {
    marginLeft: 16,
    flex: 1,
  },
  actionTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  actionSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
  },
  statusSection: {
    marginBottom: 32,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  grayCard: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  greenCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  cardText: {
    color: "#6B7280",
    fontSize: 16,
  },
  boldText: {
    fontWeight: "bold",
  },
  tipCard: {
    marginTop: 32,
    padding: 24,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  tipText: {
    color: "#374151",
    fontSize: 16,
    lineHeight: 24,
  },
  versionInfo: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  versionText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
  },
});
