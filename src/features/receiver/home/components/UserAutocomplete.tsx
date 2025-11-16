import Colors from "@/theme/Colors";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useUserSearch } from "../hooks/useUserSearch";
import type { RecipientUser } from "../types";

export function UserAutocomplete({
  value,
  onSelect,
  onClearSelection,
  placeholder = "Nom, email… (Client B)",
}: {
  value: RecipientUser | null;
  onSelect: (u: RecipientUser) => void;
  onClearSelection?: () => void;
  placeholder?: string;
}) {
  const { query, setQuery, items, open, setOpen, loading, isEmpty } = useUserSearch();

  React.useEffect(() => {
    if (value) {
      setQuery(value.displayName || value.email || "");
    }
  }, [value]);

  const displayValue = query;

  return (
    <View style={{ position: "relative" }}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={displayValue}
        onChangeText={(t) => {
          if (value) onClearSelection?.();
          setQuery(t);
          setOpen(true);
        }}
        placeholderTextColor={Colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setOpen(true)}
      />
      {loading ? (
        <View style={{ position: "absolute", right: 12, top: 12 }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {open && items.length > 0 && (
        <View style={[styles.suggestBox, { position: "absolute", left: 0, right: 0, top: "100%" }]}>
          {items.map((u) => (
            <Pressable
              key={u.id}
              style={styles.suggestItem}
              onPress={() => {
                onSelect(u);
                setQuery(u.displayName || u.email || "");
                setOpen(false);
              }}
            >
              <Text style={styles.suggestText}>
                {u.displayName}
                {u.email ? ` — ${u.email}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {open && !loading && items.length === 0 ? (
        <View style={[styles.suggestBox, { position: "absolute", left: 0, right: 0, top: "100%" }]}>
          <View style={[styles.suggestItem, { paddingVertical: 12 }]}>
            <Text style={{ color: "#64748b" }}>
              {isEmpty ? "Aucun utilisateur disponible" : "Aucun résultat"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8, color: Colors.text },
  suggestBox: { backgroundColor: "#fff", borderColor: "#ddd", borderWidth: 1, borderRadius: 8, marginTop: 6, marginBottom: 8, overflow: "hidden", zIndex: 20, elevation: 6 },
  suggestItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  suggestText: { color: "#111827" },
});
