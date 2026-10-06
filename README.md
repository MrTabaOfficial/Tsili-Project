# Tsili

Tsili (წილი, "share" in Georgian) splits shared expenses for a trip or a shared flat. Everyone enters what they paid, the app works out who owes whom, and suggests the fewest payments that settle everything. It works fully offline and syncs between phones when there is a connection.

<p>
  <img src="docs/screenshots/ledger-light.png" width="240" alt="Group ledger: summary card, balances per member, settle-up plan">
  <img src="docs/screenshots/add-expense-light.png" width="240" alt="Adding an expense split by shares, with a live preview of what each person owes">
  <img src="docs/screenshots/ledger-dark-ka.png" width="240" alt="The same ledger in Georgian and dark mode">
</p>

## What it does

- Groups with members, joined by an eight-character invite code.
- Expenses with who paid, amount, description, date and a split rule: equally, by exact amounts, or by shares (2:1:1).
- Balances per member and a settle-up plan, recomputed from the records every time.
- Repayments ("Nino paid Luka 40 GEL") recorded alongside expenses.
- Offline first: every screen works without a server. Changes are pushed and pulled when signed in.
- English and Georgian, light and dark, following the device by default.

## How it is built

```
shared/   TypeScript types, zod schemas and the money logic both ends run
server/   Node, Express 5, PostgreSQL, Prisma, JWT with rotating refresh tokens
app/      Expo (React Native), Expo Router, SQLite
```

The three are npm workspaces. `shared` is consumed as source by both the app bundler and the server runtime, so there is exactly one implementation of splitting, balances and settle-up, and the server can verify what phones send by recomputing it.

Tests run with Vitest: pure logic in `shared`, HTTP tests against a real PostgreSQL in `server`, and the app's data layer and sync engine against Node's built-in SQLite, so the offline code is unit-tested without a device.

## Decisions worth knowing

**Money is integers.** Every amount is a whole number of tetri. Decimal text appears only at the edges, where input is parsed with string arithmetic and output is formatted per locale.

**Leftover tetri go by largest remainder.** 100 tetri split three ways is 34, 33, 33. The extra goes to the member with the largest fractional share; on a tie, to the smaller member id. Deterministic, so every phone computes the same split, and the server rejects an expense whose stored shares do not match its rule.

**Settle-up is greedy.** Exact matches are paired first, then the largest debtor pays the largest creditor until everything clears. It never needs more payments than members with a non-zero balance minus one. Finding the absolute minimum is NP-hard, and the greedy plan is the right trade for groups of friends.

**Sync is last-write-wins per record.** Every record carries a client-made UUID, `createdAt`, `updatedAt` and `deletedAt`. A phone pushes its changed rows and pulls everything past a server-side sequence cursor. On conflict, the newer `updatedAt` wins, and the loser receives the server copy so it converges. Rejected records are reported, not dropped, and stay queued on the phone. Syncs for a group are serialised with a PostgreSQL advisory lock so a slow writer cannot commit behind a cursor that has already moved.

**Members are not accounts.** A group can be set up offline with names only. When someone joins with the invite code, they claim the member slot that already carries their expenses.

**Auth.** Short-lived HS256 access tokens, opaque refresh tokens stored only as hashes and rotated on every use; replaying a used token revokes that whole session. Passwords use Node's built-in scrypt. Login answers identically for unknown email and wrong password. Credential endpoints are rate limited per address.

**Georgian needs grammar, not just words.** "Nino pays Luka" is "ნინო უხდის ლუკას". The translation layer inflects names with dative and ergative endings, and writes Latin-script names the way Georgian does, "Luka-ს".

## Running it

Prerequisites: Node 22 or newer, Docker, and Expo Go on a phone (or a simulator).

```sh
npm install                      # all workspaces; also generates the Prisma client

# Server
cp server/.env.example server/.env   # set JWT_SECRET to any string of 32+ characters
npm run db:up -w server              # PostgreSQL in Docker
npm run db:deploy -w server          # apply migrations
npm run dev -w server                # http://localhost:4000

# App
cp app/.env.example app/.env         # set EXPO_PUBLIC_API_URL to your computer's LAN address
npm run start -w app                 # scan the QR code with Expo Go
```

The app does everything locally without the server. Signing in enables sync and invite codes.

### Tests and checks

```sh
npm test                 # shared, server (needs the Docker database), app
npm run typecheck
npm run bundle:check -w app   # Metro bundle for Android, catches import and config errors
```

## Status and roadmap

Everything above is implemented and tested. Next steps, roughly in order: a development build instead of Expo Go, a native date picker, invite links that open the app directly, continuous integration, and pagination of the sync pull for very large groups.

Known limits kept on purpose for now: conflicts are resolved by device clock, one currency per group, and the web build (used for automated UI checks) cannot survive a same-tab reload because expo-sqlite's web storage holds an exclusive lock.
