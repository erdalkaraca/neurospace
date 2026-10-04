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

## Roadmap

Official ACT-R 7 is a threaded Lisp (SBCL or CCL), a TCP JSON-RPC dispatcher, the Tcl/Tk Environment, and the tutorial experiments that drive models through that dispatcher. This image runs the official core with `load-single-threaded-act-r.lisp` inside threadless ECL. CheerpX cannot host the upstream process model (SBCL failed here, ECL is built `--disable-threads`, and the Tk Environment is not a browser UI). Matching official ACT-R means the same models, commands, experiments, and inspection tools on the mailbox.

What works now: boot the core, `evaluate` a command, `load-model` the editor buffer, `run` for 10 seconds, and show the text trace. The terminal accepts a command name plus space-separated arguments. Tutorial texts and task sources live in `content/` for reading; `tutorial/`, `examples/`, `docs/`, `user-guides/`, `extras/`, and `environment/` are deleted from the guest image.

### 1. Dispatcher parity

The mailbox implements `evaluate`, `load-model`, and `quit`. Official clients also use `add`, `remove`, `monitor`, `remove-monitor`, `check`, and command listing, and they receive a callback when a monitored command fires (`output-key`, `output-speech`, button actions). There is no Lisp → JS event path today, so an experiment cannot record a response the way `fan.py` does.

The mailbox JSON codec encodes strings, numbers, arrays, and keyword alists. Command results that are symbols, and arguments that official clients send as symbol objects (`{"name":"..."}`), need a defined round-trip. `evaluate` from the editor and terminal always passes `false` as the model, so a named model cannot be selected.

### 2. Run control

The editor has one action: reset, load the open file, run 10 seconds. The listener needs reload, reset, `run` / `run-full-time` with a chosen duration, and stop. A run currently blocks the only thread until it returns, so Stop has to be sliced runs or a flag the run loop polls between events. The terminal should accept the same forms the ACT-R listener does, including keywords, strings, and lists, instead of only flat tokens.

### 3. Experiment window

Tutorial models attend to the experiment device (`open-exp-window`, `add-text-to-exp-window`, `add-button-to-exp-window`, `add-line-to-exp-window`) and act through the keyboard and mouse devices. That device code is in the core; the stripped `environment/` tree is only the Tk viewer. An HTML view should draw those items and send clicks and keypresses back as device actions. A virtual window is enough when only the model runs.

### 4. Tutorial tasks

With the dispatcher callbacks and the HTML device view, port the task scripts in `content/tutorial/python/` (and the matching `lisp/` files) to JavaScript: present each trial, run the bundled model, and score it against the human data in the script. Unit 1 can stay a model load plus `run`. Later units need the device (unit 2 and the perceptual-motor tasks), speech and sound (Siegler, subitize), and learning across trials (paired associates, building sticks, past tense).

### 5. Loadable distribution

`examples/` and `extras/` have to be loadable from the image or staged on demand. Docs and user guides can stay in `content/`. Baking the whole deleted tree back into the ext2 image fights the size limit; fetch the file the model or task actually loads.

### 6. Inspection tools

The Environment is a dispatcher client: stepper, buffers, chunks, productions, whynot, declarative memory, visicon, parameters, and the graphic trace. Reimplement those as views over the same commands once step 1 can call them and can interrupt a run. The Tk application itself stays out of the image.
