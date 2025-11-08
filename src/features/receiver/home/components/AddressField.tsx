import Colors from "@/theme/Colors";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Suggestion } from "../types";

export function AddressField({
  label,
  value,
  onChange,
  suggestions,
  clearSuggestions,
  showGPS = false,
  onPressGPS,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  suggestions: Suggestion[];
  clearSuggestions: () => void;
  showGPS?: boolean;
  onPressGPS?: () => void;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Rue, numéro, ville…"
          value={value}
          onChangeText={onChange}
          placeholderTextColor={Colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {showGPS && (
          <TouchableOpacity onPress={onPressGPS} style={styles.gpsButton} accessibilityRole="button">
            <Text style={{ fontSize: 18 }}>📍</Text>
          </TouchableOpacity>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.suggestItem}
              onPress={() => {
                onChange(s.label);
                clearSuggestions();
              }}
            >
              <Text style={styles.suggestText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: Colors.text, marginBottom: 6, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8, color: Colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 0 },
  gpsButton: { marginLeft: 8, backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  suggestBox: { backgroundColor: "#fff", borderColor: "#ddd", borderWidth: 1, borderRadius: 8, marginTop: 6, marginBottom: 8, overflow: "hidden", zIndex: 20, elevation: 6 },
  suggestItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  suggestText: { color: "#111827" },
});