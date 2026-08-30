# Debian i386 + ECL (no threads) + Lisp-only ACT-R for CheerpX.
# Stock Debian ECL is :THREADS; Boehm GC then calls pthread_kill (ENOSYS under CheerpX).

ARG ECL_VERSION=21.2.1

# ---------------------------------------------------------------------------
# Stage 1: build single-threaded ECL
# ---------------------------------------------------------------------------
FROM --platform=linux/i386 docker.io/i386/debian:bookworm-slim AS ecl-builder

ARG DEBIAN_FRONTEND=noninteractive
ARG ECL_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    build-essential \
    m4 \
    libgmp-dev \
    libgc-dev \
    libffi-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN wget -q "https://common-lisp.net/project/ecl/static/files/release/ecl-${ECL_VERSION}.tgz" \
    -O "ecl-${ECL_VERSION}.tgz" \
  && tar -xzf "ecl-${ECL_VERSION}.tgz" \
  && cd "ecl-${ECL_VERSION}" \
  && ./configure \
    --prefix=/opt/ecl \
    --disable-threads \
    --enable-boehm=system \
    --with-dffi=system \
  && make -j"$(nproc)" \
  && make install \
  && /opt/ecl/bin/ecl -norc -eval '(progn (format t "ECL ~a features=~s~%" (lisp-implementation-version) *features*) (ext:quit 0))'

# ---------------------------------------------------------------------------
# Stage 2: CheerpX rootfs
# ---------------------------------------------------------------------------
FROM --platform=linux/i386 docker.io/i386/debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive
ARG ACTR_CONTAINER_ZIP_URL=http://act-r.psy.cmu.edu/actr7.x/actr7.container.zip

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    unzip \
    libgmp10 \
    libgc1 \
    libffi8 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ecl-builder /opt/ecl /opt/ecl
ENV PATH="/opt/ecl/bin:${PATH}" \
    LD_LIBRARY_PATH="/opt/ecl/lib"

RUN useradd -m -s /bin/bash user \
  && echo "user:actr" | chpasswd \
  && echo "root:actr" | chpasswd

WORKDIR /opt/actr

RUN wget -q "${ACTR_CONTAINER_ZIP_URL}" -O /tmp/actr7.container.zip \
  && unzip -q /tmp/actr7.container.zip -d /opt/actr \
  && rm /tmp/actr7.container.zip \
  && rm -rf \
    /opt/actr/actr7.x/tutorial \
    /opt/actr/actr7.x/examples \
    /opt/actr/actr7.x/docs \
    /opt/actr/actr7.x/user-guides \
    /opt/actr/actr7.x/extras \
    /opt/actr/actr7.x/environment \
  && apt-get purge -y --auto-remove wget unzip \
  && rm -rf /var/lib/apt/lists/*

# Bytecodes avoid needing gcc at runtime; precompile during image build.
RUN cd /opt/actr/actr7.x \
  && ecl -norc \
    -eval '(ext:install-bytecodes-compiler)' \
    -eval '(load "load-single-threaded-act-r.lisp")' \
    -eval '(format t "precompiled ACT-R ~a~%" (act-r-version-string))' \
    -eval '(ignore-errors (si:exit 0))' \
    -eval '(ignore-errors (ext:quit 0))'

COPY actr-mailbox.lisp /opt/actr-mailbox/actr-mailbox.lisp
RUN mkdir -p /opt/actr-mailbox \
  && chmod 644 /opt/actr-mailbox/actr-mailbox.lisp \
  && printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    'export PATH="/opt/ecl/bin:$PATH"' \
    'export LD_LIBRARY_PATH="/opt/ecl/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"' \
    'printf "%s" "shell-start" > /ipc-out/progress' \
    'echo "mailbox: starting Lisp-only ACT-R evaluate loop"' \
    'exec /opt/ecl/bin/ecl -norc -load /opt/actr-mailbox/actr-mailbox.lisp' \
    > /opt/actr-mailbox/actr-mailbox.sh \
  && chmod +x /opt/actr-mailbox/actr-mailbox.sh \
  && ln -sf /opt/ecl/bin/ecl /usr/local/bin/ecl
