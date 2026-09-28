# Frontend

The Codex Bruxellensis PWA (Angular + Firebase). See the Frontend section of the root `CLAUDE.md` for commands and configuration.

## Loading the songs

The songs come from `data/output/json/`, loaded into Firestore per Codex edition:

```sh
cp .env.example .env                 # fill in the FIREBASE_* values
gcloud auth application-default login   # or set FIREBASE_SERVICE_ACCOUNT to a service account JSON
pnpm import:local -- --dry-run       # check the counts, writes nothing
pnpm import:local                    # codex-test/7/{songs,clubs}
```

A new edition is loaded with `node scripts/import-edition.mjs --edition=8 --year=20XX --target=…`. Songs whose slug is already in `data/firestore-id-map.json` keep their id; new ones get an id that is added to the map.

The Firestore rules (managed in the Firebase console) must allow reading the codex collections, for example:

```
match /{root}/{edition} { allow read: if root in ['codex', 'codex-test']; }
match /{root}/{edition}/{sub}/{id} { allow read: if root in ['codex', 'codex-test']; }
```
