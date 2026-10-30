import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, NativeModules, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { checkIgdbServer, getGame, IgdbConnectionError, IgdbGame, lookupBarcode, lookupBarcodeWithFallback, LookupAttempt, PocMode, Provider, ProviderCandidate, ProviderResult, searchGames, serverFromScriptUrl } from './api';
import { Draft, LABELS, toDraft, validateDraft } from './draft';

const STEPS = ['Code-barres', 'Résultat source', 'Choix du jeu', 'Fiche enrichie'];
const EXAMPLES = [
  ['Budokai 2', '3546430108154'], ['Final Fantasy X', '711719468622'], ['Soul Reaver', '5032921005685'],
  ['Diablo III', '5030917102608'], ['Half-Life 2', '3348542180352'], ['Street Fighter II', '4974365610906'], ['Shinobi III', '4974365611361'],
];
const PROVIDER_NAMES: Record<Provider, string> = { scandex: 'ScanDex', upcitemdb: 'UPCitemdb' };
const ATTEMPT_LABELS: Record<LookupAttempt['status'], string> = {
  match: 'Correspondance trouvée', missing: 'Code absent', unmatched: 'Code connu, jeu non identifié',
  error: 'Recherche indisponible', skipped: 'Non configuré',
};

function defaultServer() {
  try {
    const script = NativeModules.SourceCode?.getConstants?.().scriptURL ?? NativeModules.SourceCode?.scriptURL;
    return serverFromScriptUrl(script);
  } catch { /* L’adresse reste modifiable si Expo n’expose pas l’hôte. */ }
  return '';
}

function Button({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
  </Pressable>;
}

function Field({ label, value, onChange, multiline = false, secure = false, numeric = false }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; secure?: boolean; numeric?: boolean;
}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value}
    onChangeText={onChange} multiline={multiline} secureTextEntry={secure} keyboardType={numeric ? 'number-pad' : 'default'}
    autoCapitalize="none" autoCorrect={false} style={[styles.input, multiline && styles.textarea]} placeholder="Non renseigné" /></View>;
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.jsonPanel}><Pressable accessibilityRole="button" onPress={() => setOpen(!open)}>
    <Text style={styles.link}>{open ? 'Masquer' : 'Voir'} {label}</Text>
  </Pressable>{open && <Text selectable style={styles.json}>{JSON.stringify(value, null, 2)}</Text>}</View>;
}

function RemoteImage({ uri, small = false, allowHttp = false }: { uri: string; small?: boolean; allowHttp?: boolean }) {
  const [failure, setFailure] = useState<{ uri: string; message: string } | null>(null);
  if (!uri) return <Text style={styles.hint}>Aucune image fournie.</Text>;
  if (!(allowHttp ? /^https?:\/\//i : /^https:\/\//i).test(uri)) return <Text selectable style={styles.hint}>Adresse d’image non prise en charge : {uri}</Text>;
  if (failure?.uri === uri) return <View style={styles.field}>
    <Text style={styles.warning}>L’image reçue ne se charge pas à cette adresse.</Text>
    <Text selectable style={styles.hint}>{failure.message}</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(uri)}><Text style={styles.link}>Ouvrir le lien original de l’image</Text></Pressable>
  </View>;
  return <Image source={{ uri }} onError={({ nativeEvent }) => setFailure({ uri, message: nativeEvent.error })} resizeMode="contain" style={small ? styles.smallCover : styles.cover} accessibilityLabel="Image fournie par le service" />;
}

export default function BarcodePocApp({ provider }: { provider: PocMode }) {
  const combined = provider === 'final';
  const name = combined ? 'Final' : PROVIDER_NAMES[provider];
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [server, setServer] = useState(defaultServer);
  const [settings, setSettings] = useState(true);
  const [connection, setConnection] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<ProviderResult | null>(null);
  const [resolvedProvider, setResolvedProvider] = useState<Provider | null>(combined ? null : provider);
  const [attempts, setAttempts] = useState<LookupAttempt[]>([]);
  const [candidate, setCandidate] = useState<ProviderCandidate | null>(null);
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<IgdbGame[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchRaw, setSearchRaw] = useState<unknown>(null);
  const [game, setGame] = useState<IgdbGame | null>(null);
  const [gameRaw, setGameRaw] = useState<unknown>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: true }); }, [step]);

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label); setError('');
    try { await action(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'L’essai a échoué. Réessaie.');
      if (caught instanceof IgdbConnectionError) {
        setSettings(true); setConnection(caught.message); scroll.current?.scrollTo({ y: 0, animated: true });
      }
    }
    finally { busyRef.current = false; setBusy(''); }
  }

  function clearEnrichment() {
    setGames([]); setSearched(false); setSearchRaw(null); setGame(null); setGameRaw(null); setDraft(null); setConfirmed(false);
  }

  async function lookup(value: string) {
    if (busyRef.current) return;
    setScanning(false);
    const code = value.trim(); setBarcode(code);
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) { setError('Saisis un code EAN/UPC de 8, 12, 13 ou 14 chiffres.'); return; }
    await run(combined ? 'Recherche du jeu par code-barres…' : `Recherche dans ${name}…`, async () => {
      setSource(null); setCandidate(null); setQuery(''); setAttempts([]); setResolvedProvider(combined ? null : provider); clearEnrichment(); setStep(1);
      let result: ProviderResult;
      if (provider === 'final') {
        const lookup = await lookupBarcodeWithFallback(code, server, (current) => setBusy(`Recherche dans ${PROVIDER_NAMES[current]}…`));
        result = lookup.result; setResolvedProvider(lookup.provider); setAttempts(lookup.attempts);
      } else {
        result = await lookupBarcode(provider, code, server);
      }
      setSource(result);
      const first = result.candidates[0] ?? null; setCandidate(first); setQuery(first?.name ?? '');
    });
  }

  async function openCamera() {
    await run('Accès à la caméra…', async () => {
      if (!permission?.granted && !(await requestPermission()).granted) throw new Error('Autorise l’accès à la caméra pour lire un code-barres.');
      setScanning(true);
    });
  }

  async function search() {
    if (query.trim().length < 2 || query.trim().length > 120) { setError('Saisis un titre de 2 à 120 caractères.'); return; }
    await run('Recherche des fiches IGDB…', async () => {
      clearEnrichment(); setStep(2);
      const result = await searchGames(server, query);
      setGames(result.games); setSearchRaw(result.raw); setSearched(true);
    });
  }

  async function choose(selected: IgdbGame) {
    await run('Chargement de la fiche complète…', async () => {
      const result = await getGame(server, selected.id);
      setGame(result.game); setGameRaw(result.raw); setDraft(toDraft(result.game)); setConfirmed(false); setStep(3);
    });
  }

  function confirm() {
    if (!draft) return;
    const message = validateDraft(draft);
    if (message) { setError(message); return; }
    setError(''); setConfirmed(true); scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function reset() {
    setStep(0); setScanning(false); setBarcode(''); setSource(null); setCandidate(null); setQuery(''); setError('');
    setAttempts([]); setResolvedProvider(combined ? null : provider); clearEnrichment();
  }

  const count = draft ? Object.keys(LABELS).filter((key) => draft[key as keyof Draft].trim()).length : 0;
  const received = game ? Object.keys(LABELS).filter((key) => toDraft(game)[key as keyof Draft].trim()).length : 0;
  const sourceName = resolvedProvider ? PROVIDER_NAMES[resolvedProvider] : 'la recherche par code-barres';

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>OWLGame · POC {name} + IGDB</Text>
      <Text style={styles.title}>{confirmed ? 'Résultat de l’essai' : STEPS[step]}</Text>
      <View style={styles.steps}>{STEPS.map((label, index) => <View key={label} style={[styles.step, index === step && styles.currentStep]}>
        <Text style={[styles.stepText, index === step && styles.currentStepText]}>{index + 1}. {label}</Text>
      </View>)}</View>
      <Pressable accessibilityRole="button" onPress={() => setSettings(!settings)} disabled={!!busy}><Text style={styles.link}>{settings ? 'Masquer' : 'Configurer'} le serveur local</Text></Pressable>
      {settings && <View style={styles.card}>
        <Field label="Adresse du serveur local (IGDB et ScanDex)" value={server} onChange={(value) => { setServer(value); setConnection(''); }} />
        <Text style={styles.hint}>Lance npm run start:igdb sur l’ordinateur. Recopie ici son adresse réseau, par exemple http://192.168.0.25:3001. Le téléphone et l’ordinateur doivent être sur le même Wi-Fi.</Text>
        <Button label="Vérifier la connexion" disabled={!!busy} secondary onPress={() => void run('Vérification du serveur…', async () => {
          const body = await checkIgdbServer(server);
          setConnection(`Serveur joignable. IGDB : ${body.configured ? 'identifiants présents' : 'identifiants manquants'}. ScanDex : ${body.scandexConfigured ? 'jeton présent sur le serveur' : 'SCANDEX_TOKEN à renseigner dans server/.env'}. Les accès seront vérifiés lors des recherches.`);
        })} />
        {!!connection && <Text style={styles.text}>{connection}</Text>}
      </View>}
      {step === 0 && <View style={styles.card}>
        <Text style={styles.text}>{combined
          ? 'La caméra lit le numéro de la boîte. ScanDex est consulté en premier, puis UPCitemdb si aucun titre n’est trouvé. Tu peux ensuite poursuivre par titre dans IGDB.'
          : `La caméra lit le numéro de la boîte. ${name} recherche ensuite une correspondance.`}</Text>
        {provider !== 'upcitemdb' && <Text style={styles.hint}>ScanDex utilise SCANDEX_TOKEN configuré dans server/.env. Le jeton reste sur l’ordinateur et n’a pas à être saisi dans l’application.</Text>}
        <Button label={scanning ? 'Fermer la caméra' : 'Ouvrir la caméra'} disabled={!!busy} onPress={scanning ? () => setScanning(false) : () => void openCamera()} />
        {scanning && <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] }}
          onBarcodeScanned={({ data }) => void lookup(data)} onMountError={({ message }) => { setScanning(false); setError(`Caméra indisponible : ${message}`); }} />}
        <Field label="Code-barres EAN / UPC" value={barcode} onChange={setBarcode} numeric />
        <Button label={combined ? 'Rechercher le jeu par code-barres' : `Rechercher dans ${name}`} disabled={!!busy} onPress={() => void lookup(barcode)} />
        <Text style={styles.label}>Reprendre un code de nos essais</Text>
        <View style={styles.chips}>{EXAMPLES.map(([label, code]) => <Pressable accessibilityRole="button" disabled={!!busy} key={code} onPress={() => { setBarcode(code); setScanning(false); setError(''); }} style={styles.chip}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
      </View>}
      {step === 1 && <>
        <View style={styles.card}>
          <Text selectable style={styles.label}>Code lu : {barcode}</Text>
          {combined && attempts.length > 0 && <View style={styles.field}>
            <Text style={styles.label}>Recherches effectuées dans l’ordre</Text>
            {attempts.map((attempt, index) => <View key={attempt.provider} style={styles.sourceChoice}>
              <Text style={styles.label}>{index + 1}. {PROVIDER_NAMES[attempt.provider]} : {ATTEMPT_LABELS[attempt.status]}</Text>
              {!!attempt.message && <Text style={styles.warning}>{attempt.message}</Text>}
              {attempt.raw !== undefined && <JsonPanel label={`le JSON de ${PROVIDER_NAMES[attempt.provider]}`} value={attempt.raw} />}
            </View>)}
          </View>}
          {source?.status === 'match' && <>
            {combined && <Text style={styles.success}>Source retenue : {sourceName}</Text>}
            <Text style={styles.text}>{source.candidates.length} résultat(s) renvoyé(s) par {sourceName}. Vérifie la correspondance avec ta boîte.</Text>
          </>}
          {source?.status === 'missing' && <Text style={styles.text}>{combined
            ? 'Aucun titre exploitable n’a été obtenu auprès des fournisseurs. Saisis le nom du jeu pour poursuivre avec IGDB.'
            : `Ce code n’a pas de résultat exploitable dans ${name}. Tu peux saisir le titre pour poursuivre avec IGDB.`}</Text>}
          {source?.status === 'unmatched' && <Text style={styles.text}>ScanDex connaît le code, mais n’a pas identifié le jeu. Tu peux poursuivre par titre.</Text>}
          {source?.candidates.map((item, index) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: candidate === item }} key={index} disabled={!!busy}
            onPress={() => { setCandidate(item); setQuery(item.name); clearEnrichment(); }} style={[styles.sourceChoice, candidate === item && styles.selected]}>
            <Text style={styles.subtitle}>{item.name}</Text>
            {!!item.platform && <Text style={styles.warning}>Plateforme proposée par ScanDex : {item.platform}. À confirmer sur la boîte.</Text>}
            {!!item.brand && <Text style={styles.text}>Marque / fabricant : {item.brand}</Text>}
            <Text selectable style={styles.hint}>EAN fourni : {item.ean}</Text>
            {!!item.description && <Text style={styles.text}>{item.description}</Text>}
            <Text style={styles.link}>{candidate === item ? 'Résultat retenu pour la recherche' : 'Retenir ce résultat'}</Text>
          </Pressable>)}
          {candidate && resolvedProvider === 'upcitemdb' && <View style={styles.field}>
            <Text style={styles.label}>Images reçues d’UPCitemdb ({candidate.imageUrls.length})</Text>
            {!candidate.imageUrls.length && <Text style={styles.hint}>Ce produit ne contient aucune URL d’image.</Text>}
            {candidate.imageUrls.map((uri, index) => <View style={styles.field} key={`${uri}-${index}`}>
              <Text style={styles.hint}>Image {index + 1}</Text>
              <RemoteImage uri={uri} allowHttp />
              <Text selectable style={styles.hint}>{uri}</Text>
            </View>)}
          </View>}
          {source && !combined && <JsonPanel label={`le JSON complet de ${name}`} value={source.raw} />}
        </View>
        <View style={styles.card}>
          <Field label="Titre à rechercher dans IGDB" value={query} onChange={setQuery} />
          <Text style={styles.hint}>Tu peux corriger le titre ou enlever les mentions commerciales comme « Complete VF ». Aucun jeu n’est choisi automatiquement.</Text>
          <Button label="Rechercher les fiches IGDB" disabled={!!busy} onPress={() => void search()} />
          <Button label="Revenir au code-barres" disabled={!!busy} secondary onPress={() => { setStep(0); setError(''); }} />
        </View>
      </>}
      {step === 2 && <View style={styles.card}>
        <Text style={styles.text}>Choisis le jeu correspondant à ta boîte. Vérifie son titre, ses plateformes et sa jaquette.</Text>
        <Field label="Titre recherché dans IGDB" value={query} onChange={setQuery} />
        <Button label="Lancer la recherche IGDB" disabled={!!busy} onPress={() => void search()} />
        {searched && <Text style={styles.label}>{games.length} fiche(s) trouvée(s)</Text>}
        {searched && !games.length && <Text style={styles.text}>Essaie un titre plus court, son nom anglais ou son nom international.</Text>}
        {games.map((item) => <View key={item.id} style={styles.gameChoice}>
          <RemoteImage uri={item.coverUrl} small />
          <Text style={styles.subtitle}>{item.name}</Text>
          <Text style={styles.text}>{item.platforms.map((p) => p.name).join(' · ') || 'Plateformes non renseignées'}</Text>
          <Text style={styles.hint}>Première sortie : {item.firstReleaseDate || 'non renseignée'} · IGDB #{item.id}</Text>
          <Button label="Choisir cette fiche" disabled={!!busy} onPress={() => void choose(item)} />
        </View>)}
        {searched && <JsonPanel label="le JSON de la recherche IGDB" value={searchRaw} />}
        <Button label={combined ? 'Revenir aux résultats du code-barres' : `Revenir au résultat ${name}`} disabled={!!busy} secondary onPress={() => { setStep(1); setError(''); }} />
      </View>}
      {step === 3 && draft && game && <>
        <View style={styles.card}>
          <Text selectable style={styles.label}>Code : {barcode} · Fiche IGDB #{game.id}</Text>
          <Text style={styles.text}>IGDB a renseigné {received}/7 champs de catalogue. Après correction : {count}/7. Les champs vides peuvent être complétés à la main.</Text>
          <RemoteImage uri={draft.coverUrl} />
          {confirmed ? <>
            <Text style={styles.success}>Données confirmées pour cet essai.</Text>
            <Text style={styles.subtitle}>{draft.name}</Text>
            <Text style={styles.text}>Plateforme possédée : {draft.platform}</Text>
            {Object.entries(LABELS).filter(([key]) => key !== 'name').map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><Text selectable style={styles.text}>{draft[key as keyof Draft] || 'Non renseigné'}</Text></View>)}
            <Button label="Partager le résultat de l’essai" disabled={!!busy} onPress={() => void run('Préparation du résultat…', async () => {
              await Share.share({ message: JSON.stringify({ barcode, provider: resolvedProvider ? sourceName : null, ...(combined ? { attempts } : {}), sourceCandidate: candidate, igdbId: game.id, igdbOriginal: game, confirmedAt: new Date().toISOString(), data: draft }, null, 2) });
            })} />
            <Button label="Corriger ces données" secondary onPress={() => setConfirmed(false)} />
          </> : <>
            <Text style={styles.label}>Plateforme de ta boîte — choix obligatoire</Text>
            <View style={styles.chips}>{game.platforms.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: draft.platform === item.name }} key={item.id}
              style={[styles.chip, draft.platform === item.name && styles.selected]} onPress={() => setDraft({ ...draft, platform: item.name })}><Text style={styles.chipText}>{item.name}</Text></Pressable>)}</View>
            <Field label="Plateforme possédée (à saisir si elle manque)" value={draft.platform} onChange={(platform) => setDraft({ ...draft, platform })} />
            {!!draft.platform && !game.platforms.some((item) => item.name === draft.platform) && <Text style={styles.warning}>Cette plateforme n’apparaît pas dans la fiche IGDB choisie. Vérifie la boîte et la correspondance du jeu.</Text>}
            {Object.entries(LABELS).map(([key, label]) => <Field key={key} label={label} value={draft[key as keyof Draft]}
              multiline={key === 'description'} onChange={(value) => setDraft({ ...draft, [key]: value })} />)}
            <Text style={styles.hint}>Sépare les genres et les éditeurs par des virgules. Vérifie la langue de la description, le PEGI et la jaquette : les données du fournisseur ne sont pas toujours complètes.</Text>
            <Button label="Confirmer le jeu et la plateforme" onPress={confirm} />
          </>}
          <Text style={styles.hint}>Le résultat de ce POC reste en mémoire pendant l’essai.</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.igdb.com')}><Text style={styles.link}>Informations et jaquette : IGDB.com</Text></Pressable>
          <JsonPanel label="le JSON original de la fiche IGDB" value={gameRaw} />
          <Button label="Choisir une autre fiche IGDB" secondary onPress={() => { setStep(2); setConfirmed(false); setError(''); }} />
        </View>
        <Button label="Tester un autre code-barres" secondary onPress={reset} />
      </>}
      {!!busy && <View style={styles.feedback}><ActivityIndicator color="#4b6584" /><Text style={styles.text}>{busy}</Text></View>}
      {!!error && <View accessibilityRole="alert" style={styles.error}><Text selectable style={styles.errorText}>{error}</Text></View>}
    </ScrollView>
    <StatusBar style="dark" />
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6fa' }, content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 48, gap: 14 },
  eyebrow: { color: '#4b6584', fontSize: 13, fontWeight: '700' }, title: { color: '#202c3b', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#202c3b', fontSize: 19, fontWeight: '700' }, steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  step: { borderWidth: 1, borderColor: '#d7dee8', borderRadius: 8, padding: 8 }, currentStep: { backgroundColor: '#4b6584', borderColor: '#4b6584' },
  stepText: { fontSize: 12, color: '#546273' }, currentStepText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderColor: '#d7dee8', borderWidth: 1, padding: 16, gap: 14 }, field: { gap: 7 },
  label: { color: '#202c3b', fontSize: 14, fontWeight: '700' }, text: { color: '#344457', fontSize: 15, lineHeight: 22 },
  hint: { color: '#637183', fontSize: 13, lineHeight: 19 }, warning: { color: '#825200', fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: '#fafbfd', borderColor: '#cbd4e0', borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, color: '#202c3b' },
  textarea: { minHeight: 130, textAlignVertical: 'top' },
  button: { backgroundColor: '#4b6584', borderWidth: 1, borderColor: '#4b6584', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' }, secondaryButton: { backgroundColor: '#fff' },
  secondaryButtonText: { color: '#4b6584' }, disabled: { opacity: 0.45 }, link: { color: '#3e5f88', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  camera: { height: 260, borderRadius: 12, overflow: 'hidden' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: '#cbd4e0', borderWidth: 1, borderRadius: 8, padding: 10, backgroundColor: '#fafbfd' }, chipText: { color: '#344457', fontSize: 13 },
  sourceChoice: { padding: 12, borderWidth: 1, borderColor: '#d7dee8', borderRadius: 10, gap: 8 }, selected: { borderColor: '#4b6584', backgroundColor: '#eef3fa', borderWidth: 2 },
  gameChoice: { borderTopWidth: 1, borderColor: '#d7dee8', paddingTop: 16, gap: 10 },
  cover: { height: 260, width: '100%', alignSelf: 'center' }, smallCover: { height: 150, width: '100%', alignSelf: 'center' },
  jsonPanel: { borderTopWidth: 1, borderColor: '#e1e6ed', paddingTop: 10, gap: 10 },
  json: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, lineHeight: 17, color: '#344457' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }, error: { backgroundColor: '#fff0ee', borderRadius: 10, padding: 14 },
  errorText: { color: '#9b3026', fontSize: 14, lineHeight: 21 }, success: { color: '#236344', fontSize: 16, fontWeight: '700' },
});
