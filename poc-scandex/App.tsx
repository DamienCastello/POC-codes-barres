import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = 'https://scandex.gamery.app/api/v2/lookup';
const EXAMPLE_BARCODE = '0711719577966';

type LookupResult =
  | { kind: 'match'; name: string; platform: string }
  | { kind: 'unmatched' | 'missing' }
  | { kind: 'error'; message: string };

type ScanDexResponse = {
  igdb_metadata?: { id?: number; name?: string; platform?: { name?: string } } | null;
};

function ActionButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [token, setToken] = useState('');
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const lookupInProgress = useRef(false);

  async function lookup(value: string) {
    if (lookupInProgress.current) return;
    lookupInProgress.current = true;
    setScanning(false);
    const cleaned = value.trim();
    setBarcode(cleaned);
    if (!/^\d{8,14}$/.test(cleaned)) {
      setResult({ kind: 'error', message: 'Saisis un code EAN/UPC de 8 à 14 chiffres.' });
      lookupInProgress.current = false;
      return;
    }
    if (!token.trim()) {
      setResult({ kind: 'error', message: 'Ajoute ton jeton ScanDex pour interroger l’API.' });
      lookupInProgress.current = false;
      return;
    }

    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_URL}?value=${encodeURIComponent(cleaned)}`, {
        headers: { Authorization: token.trim() },
        signal: controller.signal,
      });
      if (response.status === 404) setResult({ kind: 'missing' });
      else if (response.status === 401 || response.status === 403) setResult({ kind: 'error', message: 'Accès refusé. Vérifie le jeton ScanDex et les droits du compte.' });
      else if (!response.ok) setResult({ kind: 'error', message: `ScanDex a répondu avec le code HTTP ${response.status}.` });
      else {
        const body = (await response.json()) as ScanDexResponse;
        const game = body.igdb_metadata;
        if (!game) setResult({ kind: 'unmatched' });
        else if (typeof game.name === 'string' && game.name.trim()) {
          setResult({ kind: 'match', name: game.name, platform: game.platform?.name || 'Plateforme non renseignée' });
        } else setResult({ kind: 'error', message: 'Réponse reçue, mais les informations du jeu sont incomplètes.' });
      }
    } catch (error) {
      setResult({ kind: 'error', message: error instanceof Error && error.name === 'AbortError' ? 'La requête a dépassé 12 secondes.' : 'Connexion impossible. Vérifie le réseau du téléphone.' });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      lookupInProgress.current = false;
    }
  }

  async function openCamera() {
    if (!permission?.granted) {
      const updated = await requestPermission();
      if (!updated.granted) {
        setResult({ kind: 'error', message: 'Autorise l’accès à la caméra pour scanner un jeu.' });
        return;
      }
    }
    setResult(null);
    setScanning(true);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>OWLGame · POC</Text>
        <Text style={styles.title}>Scanner un jeu</Text>
        <Text style={styles.intro}>La caméra lit le code-barres. ScanDex recherche ensuite le jeu et sa plateforme.</Text>
        <Text style={styles.label}>Jeton d’accès ScanDex</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setToken} placeholder="Jeton du compte ScanDex" secureTextEntry style={styles.input} value={token} />
        <Text style={styles.hint}>Le jeton reste uniquement en mémoire pendant cet essai.</Text>
        <ActionButton label={scanning ? 'Fermer la caméra' : 'Ouvrir la caméra'} onPress={scanning ? () => setScanning(false) : () => void openCamera()} />
        {scanning && (
          <View style={styles.cameraWrap}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] }}
              facing="back"
              onBarcodeScanned={({ data }) => void lookup(data)}
              onMountError={({ message }) => { setScanning(false); setResult({ kind: 'error', message: `Caméra indisponible : ${message}` }); }}
              style={styles.camera}
            />
            <Text style={styles.cameraHint}>Place le code-barres de la boîte dans le cadre.</Text>
          </View>
        )}
        <Text style={styles.separator}>ou teste avec un numéro</Text>
        <Text style={styles.label}>Code EAN / UPC</Text>
        <TextInput keyboardType="number-pad" maxLength={14} onChangeText={setBarcode} placeholder="Ex. 0711719577966" style={styles.input} value={barcode} />
        <Text style={styles.example} onPress={() => setBarcode(EXAMPLE_BARCODE)}>Utiliser le code d’exemple de ScanDex</Text>
        <ActionButton label="Rechercher ce code" onPress={() => void lookup(barcode)} disabled={loading} />
        {loading && <ActivityIndicator color="#4b6584" size="large" style={styles.loading} />}
        {result && (
          <View style={styles.result}>
            {result.kind === 'match' && <><Text style={styles.resultStatus}>Jeu reconnu</Text><Text style={styles.resultTitle}>{result.name}</Text><Text style={styles.resultText}>Plateforme : {result.platform}</Text></>}
            {result.kind === 'unmatched' && <><Text style={styles.resultStatus}>Code connu, jeu non identifié</Text><Text style={styles.resultText}>ScanDex connaît ce code, mais ne propose pas encore de correspondance avec un jeu.</Text></>}
            {result.kind === 'missing' && <><Text style={styles.resultStatus}>Code inconnu</Text><Text style={styles.resultText}>Ce code-barres n’est pas encore présent dans ScanDex.</Text></>}
            {result.kind === 'error' && <><Text style={styles.resultStatus}>Essai non abouti</Text><Text style={styles.resultText}>{result.message}</Text></>}
          </View>
        )}
      </ScrollView>
      <StatusBar style="dark" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6fa' },
  content: { paddingHorizontal: 22, paddingTop: 64, paddingBottom: 48, gap: 10 },
  eyebrow: { color: '#4b6584', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#202c3b', fontSize: 32, fontWeight: '800' },
  intro: { color: '#546273', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  label: { color: '#202c3b', fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { backgroundColor: '#fff', borderColor: '#d7dee8', borderRadius: 12, borderWidth: 1, color: '#202c3b', fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  hint: { color: '#6a7786', fontSize: 12, marginBottom: 8 },
  button: { alignItems: 'center', backgroundColor: '#4b6584', borderRadius: 12, padding: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cameraWrap: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', paddingBottom: 10 },
  camera: { height: 270 },
  cameraHint: { color: '#546273', fontSize: 13, paddingHorizontal: 12, paddingTop: 10, textAlign: 'center' },
  separator: { color: '#6a7786', fontSize: 13, marginTop: 16, textAlign: 'center' },
  example: { color: '#4b6584', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  loading: { marginTop: 18 },
  result: { backgroundColor: '#fff', borderColor: '#d7dee8', borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 18 },
  resultStatus: { color: '#4b6584', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  resultTitle: { color: '#202c3b', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  resultText: { color: '#344457', fontSize: 15, lineHeight: 22 },
});
