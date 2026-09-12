# ACT-R CheerpX (Debian i386 + ECL + Lisp-only ACT-R)

In-browser path via [CheerpX](https://cheerpx.io/). Uses **ECL** (no threads; SBCL failed under CheerpX) and ACT-R **`load-single-threaded-act-r.lisp`** (no QuickLisp / no TCP dispatcher).

## Build

```bash
cd packages/extension-actr
npm run cheerpx:build-image
```

Produces `cheerpx/dist/actr-cheerpx/`:

- `actr-cheerpx.ext2.meta` — total byte size (for CheerpX `GitHubDevice`)
- `actr-cheerpx.ext2.c000000.txt`, … — **128 KB** chunks by default (`CHUNK_BYTES=128K` in `build-ext2.sh`)

  Do not use 1 MB chunks: CheerpX `GitHubDevice` reassembles them into a corrupt ext2 image in the browser (`ELF execution failed [-2]` on `/bin/sh`, ECL, etc.). 128 KB works reliably (~1.5k chunk files for a 192 MB image).

This matches the [WebVM GitHub Pages workflow](https://labs.leaningtech.com/blog/mini-webvm-your-linux-box-from-dockerfile-via-wasm): chunked ext2 instead of one large blob.

The image allocates **192 MB** by default (`IMAGE_SIZE` in `build-ext2.sh`); actual rootfs content is ~130 MB after stripping tutorial/docs/extras/GUI environment assets from the ACT-R container zip.

## Editor Run (Neurospace app)

1. Build the image (`npm run cheerpx:build-image`) — required after mailbox/slot changes.
2. Start the app (`packages/app`) — Vite serves `/actr-cheerpx/*` via `actrCheerpXImagePlugin` and copies chunks into `dist/` on production build.
3. Open a `.lisp` ACT-R model and click **Start console** or **Run**.

Each editor gets a dedicated ACT-R Terminal console (hidden profile `terminal.actr`) backed by its own ECL mailbox process (`ACTR_SLOT`). Processes share one CheerpX VM; IPC files are slot-prefixed on `/ipc-in` and `/ipc-out`. Closing the console disposes that process; the editor can start a fresh one.

First console boot loads CheerpX + ACT-R (can take minutes). Later consoles reuse the warm VM but still pay per-process ACT-R load.

The image base URL follows Vite `base` (e.g. `/neurospace/actr-cheerpx/actr-cheerpx.ext2` on GitHub Pages). Override if needed (no `.meta` suffix):

```js
window.__ACTR_CHEERPX_IMAGE__ = '/neurospace/actr-cheerpx/actr-cheerpx.ext2';
```

## File mailbox IPC

| Mount | Device | Direction |
|-------|--------|-----------|
| `/ipc-in` | `DataDevice` | JS → Lisp (`{slot}.r{id}.json` + `{slot}.r{id}.ready`; model source as one `{slot}model{token}.lisp`) |
| `/ipc-out` | `IDBDevice` | Lisp → JS (`{slot}.res.*`, `{slot}.progress`, `{slot}.ready`, `{slot}.console`) |

Set `ACTR_SLOT` in the guest env (default `main`) so multiple mailbox processes can share the mounts.

Same ACT-R remote `evaluate` body as TCP JSON-RPC 1.0, without EOT framing. Console commands from the Terminal go through `evaluate` (e.g. `run 10`, `reset`).

- Client: `src/mailbox-client.ts`
- Runtime: `src/actr-cheerpx-service.ts` (VM + process manager)
- Terminal: `src/actr-terminal-backend.ts`

## Notes

- Bytecodes compiler (`ext:install-bytecodes-compiler`) — no gcc at runtime
- ACT-R precompiled to `.fasc` at image build time
- Single-threaded ACT-R stubs cl-json; mailbox ships its own tiny JSON codec
- ECL may warn about `/proc`; keep a long-lived mailbox process
- CheerpX is proprietary — check licensing before production redistribution
- GitHub Pages total site size is ~1 GB — a 192 MB image at 128 KB/chunk is ~1.5k files (each chunk is well under the 100 MB per-file limit)
