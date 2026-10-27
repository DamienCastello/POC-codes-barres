import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = 'https://api.upcitemdb.com/prod/trial/lookup';
const EXAMPLE_BARCODE = '0711719546658';

type Product = {
  ean?: string;
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: string[];
};

type ApiResponse = {
  code?: string;
  total?: number;
  items?: Product[];
};

type LookupResult =
  | { kind: 'match'; products: Product[]; total: number }
  | { kind: 'missing' | 'too-fast' | 'limit' }
  | { kind: 'error'; message: string };

function ActionButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imageUrl = product.images?.find((url) => url.startsWith('https://'));
  return (
    <View style={styles.productCard}>
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="contain" accessibilityLabel="Image du produit fournie par UPCitemdb" />}
      <Text style={styles.productTitle}>{product.title?.trim() || 'Titre non renseigné'}</Text>
      {!!product.brand?.trim() && <Text style={styles.resultText}>Marque : {product.brand}</Text>}
      {!!product.category?.trim() && <Text style={styles.resultText}>Catégorie : {product.category}</Text>}
      {!!product.ean?.trim() && <Text style={styles.resultText}>EAN : {product.ean}</Text>}
      {!!product.description?.trim() && <Text style={styles.description}>{product.description}</Text>}
    </View>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
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
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(cleaned)) {
      setResult({ kind: 'error', message: 'Saisis un code de 8, 12, 13 ou 14 chiffres.' });
      lookupInProgress.current = false;
      return;
    }

    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_URL}?upc=${encodeURIComponent(cleaned)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (response.status === 404 || body.code === 'NOT_FOUND') setResult({ kind: 'missing' });
      else if (response.status === 429 && body.code === 'TOO_FAST') setResult({ kind: 'too-fast' });
      else if (response.status === 429) setResult({ kind: 'limit' });
      else if (response.status === 400) setResult({ kind: 'error', message: 'UPCitemdb considère ce code comme invalide.' });
      else if (!response.ok) setResult({ kind: 'error', message: `UPCitemdb a répondu avec le code HTTP ${response.status}.` });
      else if (body.items?.length) setResult({ kind: 'match', products: body.items, total: body.total ?? body.items.length });
      else setResult({ kind: 'missing' });
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
        <Text style={styles.eyebrow}>OWLGame · POC UPCitemdb</Text>
        <Text style={styles.title}>Scanner un jeu</Text>
        <Text style={styles.intro}>La caméra lit le code-barres. UPCitemdb cherche ensuite le produit correspondant. Vérifie que le titre obtenu correspond bien à ta boîte.</Text>
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
        <TextInput keyboardType="number-pad" maxLength={14} onChangeText={setBarcode} placeholder="Ex. 0711719546658" style={styles.input} value={barcode} />
        <Text style={styles.example} onPress={() => setBarcode(EXAMPLE_BARCODE)}>Utiliser un code d’exemple reconnu</Text>
        <ActionButton label="Rechercher ce code" onPress={() => void lookup(barcode)} disabled={loading} />
        {loading && <ActivityIndicator color="#4b6584" size="large" style={styles.loading} />}
        {result && (
          <View style={styles.result}>
            {result.kind === 'match' && <>
              <Text style={styles.resultStatus}>{result.total} produit{result.total > 1 ? 's' : ''} trouvé{result.total > 1 ? 's' : ''}</Text>
              <Text style={styles.resultText}>UPCitemdb est une base généraliste. La plateforme peut apparaître dans le texte, sans champ dédié garanti.</Text>
              {result.products.map((product, index) => <ProductCard key={`${product.ean ?? 'produit'}-${index}`} product={product} />)}
            </>}
            {result.kind === 'missing' && <><Text style={styles.resultStatus}>Code absent</Text><Text style={styles.resultText}>UPCitemdb ne trouve pas ce code-barres dans sa base.</Text></>}
            {result.kind === 'too-fast' && <><Text style={styles.resultStatus}>Requêtes trop rapprochées</Text><Text style={styles.resultText}>Patiente avant le prochain essai : la formule gratuite limite le rythme des recherches.</Text></>}
            {result.kind === 'limit' && <><Text style={styles.resultStatus}>Limite atteinte</Text><Text style={styles.resultText}>La formule gratuite a temporairement refusé la recherche. Réessaie plus tard.</Text></>}
            {result.kind === 'error' && <><Text style={styles.resultStatus}>Essai non abouti</Text><Text style={styles.resultText}>{result.message}</Text></>}
          </View>
        )}
        <Text style={styles.quota}>UPCitemdb gratuit : 100 requêtes par jour, avec une limite de rythme.</Text>
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
  button: { alignItems: 'center', backgroundColor: '#4b6584', borderRadius: 12, padding: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cameraWrap: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', paddingBottom: 10 },
  camera: { height: 270 },
  cameraHint: { color: '#546273', fontSize: 13, paddingHorizontal: 12, paddingTop: 10, textAlign: 'center' },
  separator: { color: '#6a7786', fontSize: 13, marginTop: 16, textAlign: 'center' },
  example: { color: '#4b6584', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  loading: { marginTop: 18 },
  result: { backgroundColor: '#fff', borderColor: '#d7dee8', borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 18, gap: 8 },
  resultStatus: { color: '#4b6584', fontSize: 14, fontWeight: '800' },
  resultText: { color: '#344457', fontSize: 15, lineHeight: 22 },
  productCard: { borderColor: '#d7dee8', borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 6 },
  productImage: { alignSelf: 'center', height: 180, width: 180 },
  productTitle: { color: '#202c3b', fontSize: 20, fontWeight: '800' },
  description: { color: '#546273', fontSize: 13, lineHeight: 19, marginTop: 4 },
  quota: { color: '#6a7786', fontSize: 12, marginTop: 14, textAlign: 'center' },
});
