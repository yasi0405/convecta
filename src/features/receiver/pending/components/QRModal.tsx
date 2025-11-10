import React from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { styles } from "../styles";

export default function QRModal({
  visible,
  onClose,
  qrError,
  qrValue,
  qrParcel,
  qrLoading,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  qrError: string | null;
  qrValue: string | null;
  qrParcel: any;
  qrLoading?: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View
        style={[
          styles.modalSafe,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={styles.modalInner}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>QR de validation de réception</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.qrClose}>Fermer ✕</Text>
            </Pressable>
          </View>

          <View style={styles.qrBody}>
            {qrError ? (
              <Text style={styles.qrError}>{qrError}</Text>
            ) : qrValue ? (
              <>
                <View style={styles.qrBox}>
                  <QRCode value={qrValue} size={260} />
                </View>
                <Text style={styles.qrHint}>
                  Montre ce QR au livreur pour valider la réception.
                </Text>
                {qrParcel?.id ? (
                  <Text style={styles.qrMeta}>Colis #{String(qrParcel.id).slice(0, 8)}…</Text>
                ) : null}
              </>
            ) : (
              qrLoading ? <ActivityIndicator /> : <Text style={styles.qrHint}>Préparation du QR…</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
