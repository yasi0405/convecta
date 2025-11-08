import Colors from "@/theme/Colors";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: { fontSize: 22, marginBottom: 14, textAlign: "center", color: Colors.text },

  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { color: Colors.textOnCard, fontWeight: "600" },
  cardText: { color: Colors.textOnCard, marginBottom: 4 },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },
  badge: {
    color: Colors.textOnCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },

  qrButton: {
    backgroundColor: "#1DB954",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  qrButtonText: { color: "#fff", fontWeight: "700" },

  editButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  editButtonText: { color: Colors.textOnCard, fontWeight: "700" },

  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalInner: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },

  qrHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  qrTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  qrClose: { color: Colors.textOnCard },

  qrBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderColor: Colors.border,
    borderWidth: 1,
  },
  qrHint: { color: Colors.textOnCard, opacity: 0.8, marginTop: 10, textAlign: "center" },
  qrMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  qrError: { color: "#ff6b6b", textAlign: "center" },
});