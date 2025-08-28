import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function ConvectaScan() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const player = useAudioPlayer(require('../assets/ping.wav'));
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Permission refusée',
          'L\'application nécessite l\'accès au micro.'
        );
      }
    })();
  }, []);

  const startScan = async () => {
    try {
      setScanning(true);
      setResult(null);

      // 1. Jouer le son "ping"
      player.seekTo(0);
      await player.play();

      // 2. Préparer et démarrer l'enregistrement
      await recorder.prepareToRecordAsync();
      recorder.record();

      // 3. Attendre 2 secondes
      await new Promise((res) => setTimeout(res, 2000));

      // 4. Arrêter l'enregistrement
      await recorder.stop();

      if (recorder.uri) {
        console.log('Audio enregistré :', recorder.uri);
        setResult('Empreinte acoustique capturée');
      } else {
        setResult('Aucune empreinte détectée');
      }
    } catch (error) {
      Alert.alert('Erreur', (error as Error).message || 'Échec du scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ConvectaScan™</Text>
      <Text style={styles.subtitle}>
        Placez l'embout sur le colis et appuyez sur "Scan"
      </Text>
      <Button
        title={scanning ? 'Scan en cours...' : 'Scan'}
        onPress={startScan}
        disabled={scanning}
      />
      {result && <Text style={styles.result}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#161D25',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  result: {
    marginTop: 20,
    fontSize: 16,
    color: 'green',
  },
});