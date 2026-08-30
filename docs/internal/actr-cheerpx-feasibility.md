# ACT-R on CheerpX — feasibility spike

Date: 2026-08-30  
Scope: in-browser only (CheerpX + file mailbox)  
Status: **implemented** — editor Run + Text Trace via `packages/extension-actr`

## Goal

Run ACT-R 7 (Common Lisp) inside the browser via [CheerpX](https://cheerpx.io/), talking to Neurospace JS through a **filesystem mailbox** ([CheerpX FS devices](https://cheerpx.io/docs/guides/File-System-support)), not TCP JSON-RPC.

## Verdict

| Question | Answer |
|----------|--------|
| Can our current `neurospace/actr:slim` image run under CheerpX? | **No** — it is **x86-64**; CheerpX only runs **32-bit x86** today |
| Is SBCL available for i386 Linux? | **Yes** — Debian `sbcl:i386` (~32 MB installed) or Alpine `sbcl` for `x86`; SBCL still supports the x86 port |
| Base distro choice | **Debian i386** (recommended) — matches WebVM/CheerpX ecosystem; glibc; easier path |
| Is CheerpX + SBCL theoretically viable? | **Plausible** — CheerpX JITs self-modifying / dynamically generated code (needed for SBCL) |
| Is ACT-R “drop in and go”? | **No** — need a new **i386** rootfs, validate threads/sockets, replace TCP with a file mailbox |
| Recommended next experiment | Boot **i386 SBCL `--version`** (no ACT-R) under CheerpX before investing in full ACT-R image |

**Overall:** CheerpX-in-browser is the production runtime path. The former Docker TCP sidecar was removed; use the editor **Run** button or rebuild the ext2 image for validation.

## Hard constraints (CheerpX)

From [cheerpx-meta](https://github.com/leaningtech/cheerpx-meta) / npm `@leaningtech/cheerpx`:

1. **ISA: i386 only** — “Currently, only 32-bit x86 binaries are supported.” x86-64 support is planned, not available.
2. **Not a full Linux kernel** — Linux-compatible syscalls; JS drives process start via `CheerpX.Linux`.
3. **Disk images** — ext2 via `HttpBytesDevice` + writable `OverlayDevice`/`IDBDevice`; large images OK in principle (WebVM uses ~GB-scale Debian), our ACT-R tree is small enough if rebuilt for i386.
4. **Networking** — browser has no raw TCP; CheerpX uses Tailscale (or custom WS proxy). Bad fit for “listen on :2650 from page JS.” Prefer **no network IPC**.
5. **Performance** — Leaning quotes ~**3×–10×** slowdown vs native; FP/SSE less optimized than integer. ACT-R models are usually fine; heavy numeric/Python stacks would hurt more.
6. **COOP/COEP** — required for `SharedArrayBuffer` / threads.

## Why the current slim image does not apply

`neurospace/actr:slim` (~152 MB) contains:

- SBCL **x86-64** under `/opt/sbcl`
- musl **x86_64** + `libzstd`
- ACT-R + QuickLisp deps

CheerpX will not execute those binaries. A CheerpX image must be rebuilt as **linux-x86 (i386)**.

## Base distro: Debian i386 (chosen)

| | **Debian i386** | **Alpine i386** |
|---|---|---|
| libc | **glibc** — what WebVM, SBCL upstream binaries, and ACT-R expect | musl — works, but less CheerpX precedent |
| CheerpX fit | **WebVM uses Debian**; ext2 image tooling and docs assume it | Possible, but you’re inventing the path |
| SBCL | `apt install sbcl` on i386 rootfs ([Debian sbcl:i386](https://packages.debian.org/sid/i386/sbcl), ~32 MB) | `apk add sbcl` on x86 (~31 MB) |
| QuickLisp / deps | Standard glibc build; fewer surprises | Fine, but musl edge cases possible |
| Image size | Larger base (~100–300 MB+ ext2) | Smaller (~50–100 MB) |
| CheerpX delivery | Same — `HttpBytesDevice` + `OverlayDevice`; size matters less (streamed + IDB cache) | Slightly smaller download |
| Build story | `debootstrap --arch i386` or minbase chroot; well documented | Custom Alpine i386 rootfs |

**Decision:** use **Debian i386 (bookworm or trixie minbase)** for the CheerpX ACT-R rootfs (`packages/extension-actr/cheerpx/`).

## SBCL on i386 — known facts

- Debian ships **`sbcl:i386`** (e.g. 2.5.2+ in bookworm/trixie, ~32 MB installed).
- Alpine also ships **`sbcl` for `x86`** if we ever need a smaller experimental image.
- Official SBCL still lists **x86** as a supported processor ([platform table](https://www.sbcl.org/platform-table.html)).
- Unknown until tested under CheerpX:
  - core compression / zstd
  - `mmap` / signal usage for the runtime
  - `bordeaux-threads` (ACT-R remote stack) under CheerpX’s thread model
  - whether ACT-R’s dispatcher can run **without** opening a TCP listen socket

## ACT-R-specific risks

ACT-R 7 remote stack pulls QuickLisp:

- `bordeaux-threads` — needs working pthreads
- `usocket` — TCP; **avoid** for CheerpX primary path
- `cl-json` — fine (pure Lisp)

Loading `load-act-r.lisp` today **starts the TCP dispatcher**. For CheerpX we must:

1. Load ACT-R **without** binding `:2650`, or immediately disable external listen, and  
2. Drive commands via a **file mailbox** on a `DataDevice` / `IDBDevice` mount (JS `writeFile` ↔ Lisp poll/read).

Pipe-based ACT-R client APIs exist in the dispatcher, but CheerpX FS devices are the clearer JS↔VM bridge per CheerpX docs.

## IPC recommendation (CheerpX-only)

Do **not** use the TCP RPC server in-browser.

```
JS  → DataDevice write  /ipc/req.json + /ipc/req.ready
Lisp poll/read request → evaluate ACT-R command
Lisp → write /ipc/res.json + /ipc/res.ready
JS  ← read response
```

Optional:

- `WebDevice` for read-only tutorial/models from extension assets  
- `IDBDevice` overlay for persistent user models / traces  
- `HttpBytesDevice` + `OverlayDevice` for the root ext2 image ([FS guide](https://cheerpx.io/docs/guides/File-System-support))

## Alternatives (if SBCL-on-CheerpX fails)

| Option | Pros | Cons |
|--------|------|------|
| **ECL / WECL** (WASM, not CheerpX) | Native browser CL | Port ACT-R; different product stack; threading limits |
| **Keep Docker TCP** for desktop; CheerpX later | Already works at 152 MB | Not in-browser; sidecar removed from repo |
| Wait for CheerpX **x86-64** | Reuse slim image | Timeline unknown; not actionable now |

## Suggested experiment ladder

1. **Smoke:** CheerpX + Debian i386 minbase + `echo` / `busybox`.
2. **SBCL only:** Debian **i386** rootfs with `sbcl --version` and `(+ 1 2)`.
3. **Threads:** tiny `bordeaux-threads` “spawn + join” test.
4. **ACT-R core:** load ACT-R with TCP disabled; `(act-r-version)` / define a tiny model.
5. **Mailbox:** Lisp poll loop + JS `DataDevice` client; run one tutorial model.

Stop at the first hard fail and reassess (ECL/WECL vs wait for x86-64 CheerpX).

## Observed CheerpX blockers (2026-08-30)

### Diagnostic ladder results

| Step | Result |
|------|--------|
| `/bin/echo` | **OK** |
| `MAP_FIXED` at SBCL addresses (`0x09..`, `0x20..`, …) | **OK** |
| Private `mmap` of `sbcl.core` (~26 MB) + read header `LCBS` | **OK** |
| `MAP_PRIVATE` COW on `sbcl.core` (6434 pages) | **OK** |
| **RWX FIXED + execute tiny code from page** | **OK** |
| `/proc/sys/kernel/randomize_va_space` | **Missing** |
| `setarch i686 -R` (personality) | **FAIL** |
| `sbcl --core` stock Debian core | **FAIL** — `unexpected forwarding pointer in scavenge` |
| `sbcl --core` uncompressed (`:compression nil`) | pending / incomplete in last run |

### Interpretation (final for this SBCL dig)

Ruled out by probes under CheerpX:

- anonymous `MAP_FIXED`
- large file `mmap`
- `MAP_PRIVATE` COW
- **RWX + executing generated machine code**
- “forgot `--core` / `/proc/self/exe` only”

Still broken:

- `personality` / `setarch -R`
- SBCL heap scavenger while loading core (`0x93e804c` in the `0x09000000` space)

Debian SBCL uses `:sb-core-compression` / `libzstd`; an uncompressed core was generated for comparison. If that also scavenges-faults (or hangs), **stock SBCL on CheerpX is blocked** — next options are ECL, Docker sidecar, or an upstream CheerpX report.

### Verdict

Low-level memory primitives CheerpX exposes are surprisingly good. **SBCL’s core loader / gencgc still does not run correctly** on CheerpX 1.1.5 with Debian i386 SBCL 2.2.9. Not a packaging issue we can fix with flags alone.

## ECL spike (in progress)

CheerpX image uses Debian **`ecl` 21.2.1** (`packages/extension-actr/cheerpx/`).

### First browser result (2026-08-30)

- `/bin/echo` OK  
- **ECL evaluated successfully:** `ECL 21.2.1` and `(+ 1 2) => 3`  
- GC warnings: `pthread_getattr_np` / missing `/proc/stat` (expected on CheerpX)  
- After Lisp ran: `Unable to interrupt process #<process SIGNAL-SERVICING …>` / EOVERFLOW on quit → drops to REPL  

**Conclusion:** ECL **runs** under CheerpX for basic eval. Process lifecycle / signal thread is rough; for ACT-R keep a long-lived process (mailbox loop) rather than relying on clean `(ext:quit)`.

### Lisp-only ACT-R on ECL (CheerpX path)

- Stock Debian ECL has `:THREADS` → Boehm GC uses `pthread_kill` → **ENOSYS (38)** under CheerpX mid-load.
- Fix: build ECL 21.2.1 with `--disable-threads` into `/opt/ecl` (see `cheerpx/Dockerfile`).
- Loader: `load-single-threaded-act-r.lisp` (no QuickLisp)
- Compiler: `ext:install-bytecodes-compiler` + precompiled `.fasc` at image build
- Smoke: `(act-r-version-string)` → `7.31.4-…`, tiny model `RUN=0.05`
- Image rootfs ~144 MB (512 MB ext2); root IDB overlay `actr-cheerpx-editor-v3`

### File mailbox IPC (implemented)

Single-threaded ACT-R **stubs cl-json** (`decode-json-from-string` is identity). Mailbox uses a tiny codec in `actr-mailbox.lisp`.

| Path | Device | Role |
|------|--------|------|
| `/ipc/in` | `DataDevice` | JS writes `req.json` + `req.ready` (token = request id) |
| `/ipc/out` | `IDBDevice` | Lisp writes `res.json` + `res.ready`; JS reads via `readFileAsBlob` |

Request/response bodies match ACT-R remote JSON-RPC 1.0 (no `\x04`):

```json
{"method":"evaluate","params":["act-r-version",false],"id":1}
{"result":["7.31.4-<3489.c:2026-06-10>"],"error":null,"id":1}
```

Verified in the Neurospace editor via `src/mailbox-client.ts` and `src/actr-cheerpx-service.ts`.

**Ship checklist:** CheerpX licensing before production; ext2 CDN/hosting strategy for large image.


## References

- CheerpX limitations: https://github.com/leaningtech/cheerpx-meta  
- Filesystems / DataDevice: https://cheerpx.io/docs/guides/File-System-support  
- CheerpX 1.0 overview: https://labs.leaningtech.com/blog/cx-10.html  
- Alpine SBCL x86: https://pkgs.alpinelinux.org/package/edge/community/x86/sbcl  
- WECL (alternate CL-in-browser): https://turtleware.eu/posts/Using-Common-Lisp-from-inside-the-Browser.html
