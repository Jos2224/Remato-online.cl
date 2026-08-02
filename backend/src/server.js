import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { synchronizeDueAuctions } from './services/auction-sync.js';

const server = app.listen(config.port, () => {
  console.log(`RematoOnline API listening on port ${config.port}`);
});

// Close auctions and advance adjudication turns on the clock.
//
// Without this the state machine only advanced when somebody happened to open the
// affected auction, so an auction could sit ACTIVE hours past its closing time and the
// bidder holding the top bid would never be told their turn had started.
const SYNC_INTERVAL_MS = 15_000;
let syncing = false;

async function runScheduledSync() {
  if (syncing) return; // never overlap: the previous pass still holds row locks
  syncing = true;
  try {
    const processed = await synchronizeDueAuctions();
    if (processed > 0) console.log(`[sync] advanced ${processed} auction(s)`);
  } catch (error) {
    // A failed pass must not kill the process; the next tick retries.
    console.error('[sync] scheduled synchronisation failed', error?.code ?? '', error?.message ?? error);
  } finally {
    syncing = false;
  }
}

const syncTimer = setInterval(runScheduledSync, SYNC_INTERVAL_MS);
syncTimer.unref?.();
runScheduledSync();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  clearInterval(syncTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
