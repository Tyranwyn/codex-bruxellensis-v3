// Loads one Codex edition from data/output/json into Firestore:
//   <codex collection>/<edition>                 {number, year, sections, songCount, clubCount}
//   <codex collection>/<edition>/songs/<id>      one song, stanzas included
//   <codex collection>/<edition>/clubs/<id>      one club
// Document ids come from data/firestore-id-map.json (slug → id), so a song keeps the same id in every
// edition and favorites keep working. Slugs missing from the map get a new id, written back to the map.
// Re-running is safe: documents are overwritten and those no longer in the data are deleted.
// Usage: node scripts/import-edition.mjs --edition=7 --year=2022 [--target=local|beta|prd] [--dry-run]
// Credentials: FIREBASE_SERVICE_ACCOUNT (path to a service account JSON), else the application default
// credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login).
import {randomInt} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, '../data');
const idMapPath = resolve(dataDir, 'firestore-id-map.json');

try {
  process.loadEnvFile(resolve(root, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const TARGETS = ['local', 'beta', 'prd'];
const BATCH_SIZE = 500;

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const fail = message => {
  console.error(message);
  process.exit(1);
};

const target = arg('target') ?? 'local';
if (!TARGETS.includes(target)) {
  fail(`Unknown target "${target}", expected one of: ${TARGETS.join(', ')}`);
}
const edition = Number(arg('edition'));
const year = Number(arg('year'));
if (!Number.isInteger(edition) || edition < 1 || !Number.isInteger(year)) {
  fail('Usage: node scripts/import-edition.mjs --edition=<number> --year=<year> [--target=local|beta|prd] [--dry-run]');
}
const dryRun = process.argv.includes('--dry-run');

const collectionVar = `FIRESTORE_CODEX_COLLECTION_${target.toUpperCase()}`;
const codexCollection = process.env[collectionVar];
if (!codexCollection) {
  fail(`Missing environment variable ${collectionVar}. Copy .env.example to .env and fill it in.`);
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const songs = readJson(resolve(dataDir, 'output/json/songs.json'));
const clubs = readJson(resolve(dataDir, 'output/json/clubs.json'));
const sections = readJson(resolve(dataDir, 'output/json/sections.json'));
const idMap = readJson(idMapPath);

// Same alphabet and length as Firestore's auto ids.
const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const autoId = () => Array.from({length: 20}, () => AUTO_ID_CHARS[randomInt(AUTO_ID_CHARS.length)]).join('');

const created = [];
function firestoreId(kind, slug) {
  if (!idMap[kind][slug]) {
    idMap[kind][slug] = autoId();
    created.push(`${kind}/${slug}`);
  }
  return idMap[kind][slug];
}

const clubDocs = new Map(clubs.map(({id: slug, ...club}, position) =>
  [firestoreId('clubs', slug), {slug, ...club, position}]));
const songDocs = new Map(songs.map(({id: slug, clubId, ...song}, position) => [firestoreId('songs', slug), {
  slug,
  ...song,
  clubId: clubId ? firestoreId('clubs', clubId) : null,
  clubSlug: clubId ?? null,
  position
}]));
const editionDoc = {number: edition, year, sections, songCount: songDocs.size, clubCount: clubDocs.size};

console.log(`edition ${edition} (${year}) → ${codexCollection}/${edition} [${target}]: ${songDocs.size} songs, ${clubDocs.size} clubs`);
if (created.length) {
  console.log(`new ids for: ${created.join(', ')}`);
}

if (dryRun) {
  console.log('dry run: nothing written');
  process.exit(0);
}

if (created.length) {
  writeFileSync(idMapPath, JSON.stringify(idMap, null, 1));
  console.log(`updated ${idMapPath}`);
}

const {applicationDefault, cert, initializeApp} = await import('firebase-admin/app');
const {getFirestore} = await import('firebase-admin/firestore');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({
  credential: serviceAccount ? cert(readJson(resolve(root, serviceAccount))) : applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || undefined
});
const db = getFirestore();
const editionRef = db.collection(codexCollection).doc(String(edition));

async function commitAll(ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_SIZE).forEach(op => op(batch));
    await batch.commit();
  }
}

async function sync(name, docs) {
  const collection = editionRef.collection(name);
  const stale = (await collection.listDocuments()).filter(ref => !docs.has(ref.id));
  await commitAll([
    ...[...docs].map(([id, data]) => batch => batch.set(collection.doc(id), data)),
    ...stale.map(ref => batch => batch.delete(ref))
  ]);
  console.log(`${name}: ${docs.size} written, ${stale.length} deleted${stale.length ? ` (${stale.map(ref => ref.id).join(', ')})` : ''}`);
}

await editionRef.set(editionDoc);
await sync('clubs', clubDocs);
await sync('songs', songDocs);
console.log('done');
