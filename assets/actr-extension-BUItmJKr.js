import{m as e,n as t}from"./fs-access-Cjcg0_Me-BYL2BwWI.js";import{A as n,B as r,I as i,at as a,c as o,ft as s,i as c,j as l,k as u,lt as d,n as f,o as p,ot as m,pt as h,st as g}from"./dist-Be2v51rR.js";import{t as _}from"./preload-helper-DpQ78BiE.js";import{t as v}from"./monaco-grammar-api-4XiCm0-S-wYEkAxQf.js";import"./lit-Cpjx5qc7.js";import{t as y}from"./api-CDQCXj9v.js";r.registerContribution(v,{name:`actr-lisp`,label:`ACT-R Lisp`,extensions:[`.lisp`],aliases:[`ACT-R`,`actr-lisp`,`ACT-R Lisp`],conf:{comments:{lineComment:`;;`,blockComment:[`#|`,`|#`]},brackets:[[`(`,`)`],[`[`,`]`]],autoClosingPairs:[{open:`[`,close:`]`},{open:`(`,close:`)`},{open:`"`,close:`"`}],surroundingPairs:[{open:`[`,close:`]`},{open:`(`,close:`)`},{open:`"`,close:`"`}]},language:{defaultToken:``,ignoreCase:!0,tokenPostfix:`.actr`,brackets:[{open:`(`,close:`)`,token:`delimiter.parenthesis`},{open:`[`,close:`]`,token:`delimiter.square`}],modelForms:`clear-all.define-model.sgp.sgp-fct.chunk-type.add-dm.add-dm-fct.define-chunks.define-chunks-fct.goal-focus.goal-focus-fct.p.pp.pp-fct.spp.spp-fct.sdm.sdm-fct.sdp.sdp-fct.dm.dm-fct.set-similarities.set-all-base-levels.set-base-levels.set-visloc-default.set-buffer-chunk.mod-chunk-fct.mod-focus-fct.buffer-read.clear-buffer.declare-buffer-usage.extend-possible-slots.install-device.open-exp-window.close-exp-window.clear-exp-window.add-text-to-exp-window.add-button-to-exp-window.add-line-to-exp-window.remove-items-from-exp-window.modify-line-for-exp-window.start-hand-at-mouse.new-digit-sound.new-tone-sound.run.run-full-time.run-until-condition.run-n-events.reset.reload.model-output.command-output.print-warning.no-output.hide-act-r-output.show-act-r-output.start-echoing-act-r-output.stop-echoing-act-r-output.act-r-random.act-r-noise.mp-time.mp-time-ms.get-time.schedule-event.schedule-event-relative.schedule-event-now.schedule-break.schedule-break-relative.load-act-r-model.add-act-r-command.remove-act-r-command.evaluate-act-r-command.call-act-r-command.monitor-act-r-command.remove-act-r-command-monitor.permute-list.mean-deviation.correlation.visible-virtuals-available`.split(`.`),productionKeywords:[`isa`,`cmd`,`state`,`buffer`,`module`,`request`,`error`,`busy`,`free`,`full`,`empty`,`requested`,`unrequested`],lispSpecials:`defun.defmacro.defvar.defparameter.defstruct.defpackage.in-package.lambda.let.let*.flet.labels.progn.prog1.prog2.if.when.unless.cond.case.ecase.and.or.not.quote.setf.setq.psetf.incf.decf.push.pushnew.pop.dolist.dotimes.do.do*.loop.return.return-from.block.catch.throw.unwind-protect.handler-case.handler-bind.ignore-errors.eval-when.declare.the.values.multiple-value-bind.multiple-value-list.destructuring-bind.with-open-file.format.print.princ.prin1.terpri.fresh-line.warn.error.load.require.provide.funcall.apply.mapcar.mapcan.maplist.reduce.find.find-if.position.member.assoc.remove.remove-if.remove-if-not.delete.sort.append.nconc.cons.list.list*.length.nth.first.second.third.rest.car.cdr.caar.cadr.cdar.cddr.last.butlast.reverse.nreverse.subseq.copy-list.null.atom.consp.listp.symbolp.numberp.stringp.functionp.eq.eql.equal.equalp.string-equal.string=.string-upcase.string-downcase.concatenate.make-array.make-hash-table.make-list.aref.gethash.remhash.setf.getf.intern.gensym.read.read-from-string.read-line.write-to-string.princ-to-string.parse-integer.floor.ceiling.truncate.round.mod.rem.abs.min.max.sqrt.exp.log.random.zerop.plusp.minusp.evenp.oddp.t.nil`.split(`.`),tokenizer:{root:[{include:`@whitespace`},{include:`@strings`},[/==>/,`keyword.operator`],[/![a-zA-Z][\w\-]*!/,`keyword.operator`],[/[+\-=?][a-zA-Z][\w\-]*\s*>/,`type`],[/=[a-zA-Z][\w\-]*/,`variable`],[/#\\./,`constant.character`],[/#(?:[xXoObB][0-9a-fA-F]+|[\\+-=<>'"&#]\S*)/,`constant.character`],[/\*[^\s(*][^*\s()]*\*/,`variable.predefined`],[/:[a-zA-Z][\w+\-<>/*&=.?!$%:@\[\]^{}~#|]*/,`keyword.constant`],[/(?<=^|[\s()])(?:nil|t)(?=$|[\s()])/,`constant.language`],[/(?:0[xX][0-9a-fA-F]+)|(?:\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|\d+(?:[eE][+-]?\d+)?/,`number`],[/[a-zA-Z*][\w+\-<>/*&=.?!$%@^{}~|]*/,{cases:{"@modelForms":`keyword`,"@productionKeywords":`keyword`,"@lispSpecials":`keyword`,"@default":`identifier`}}]],whitespace:[[/[ \t\r\n]+/,`white`],[/#\|/,`comment`,`@blockComment`],[/;.*$/,`comment`]],blockComment:[[/[^|#]+/,`comment`],[/\|#/,`comment`,`@pop`],[/[\|#]/,`comment`]],strings:[[/"/,`string`,`@stringBody`]],stringBody:[[/\\./,`string.escape`],[/"/,`string`,`@pop`],[/[^\\"]+/,`string`]]}}});var b=`actr-cheerpx`,x=`actr-cheerpx.ext2`;function S(e){return!e||e===`/`?``:e.endsWith(`/`)?e.slice(0,-1):e}function C(e=`/`){return`${S(e)}/${b}/${x}`}var w=e=>new Promise(t=>setTimeout(t,e));function T({inDevice:e,outDevice:t,pollMs:n=50,timeoutMs:r=12e4}){let i=1;async function a(e){let n=await t.readFileAsBlob(`/${e}`);return n?n.text():null}async function o({timeoutMs:e=6e5,pollMs:t=500,onProgress:n,onPoll:r}={}){let i=Date.now()+e,o=``;for(;Date.now()<i;){r?.();let e=await a(`ready`);if(e!=null&&e.trim()!==``)return e.trim();let i=(await a(`progress`)??``).trim();i&&i!==o&&(o=i,n?.(i)),await w(t)}throw Error(`mailbox did not become ready in time (last progress: ${o||`none`})`)}async function s(t,o=[]){let s=i++,c=String(s),l=JSON.stringify({method:t,params:o,id:s});await e.writeFile(`/r${c}.json`,l),await e.writeFile(`/r${c}.ready`,c);let u=Date.now()+r;for(;Date.now()<u;){if((await a(`res.ready`))?.trim()===c){let e=await a(`res.json`);if(!e)throw Error(`mailbox: res.ready present but res.json missing`);return JSON.parse(e)}await w(n)}throw Error(`mailbox timeout waiting for ${t} id=${s}`)}return{call:s,waitUntilReady:o,evaluate:(e,t=!1,...n)=>s(`evaluate`,[e,t,...n])}}var E=e(`ACT-R`),D=`https://cxrtnc.leaningtech.com/1.1.5/cx.esm.js`,O=C(`/neurospace/`),k=`actr-cheerpx-editor-v6`,A=`actr-cheerpx-editor-ipc-out-v6`,j=`/ipc-in`,M=`/ipc-out`,N=`/tmp/actr-run/model.lisp`,P=400,F={env:[`HOME=/home/user`,`USER=user`,`SHELL=/bin/bash`,`LANG=C.UTF-8`,`LC_ALL=C`,`PATH=/opt/ecl/bin:/usr/local/bin:/usr/bin:/bin`,`LD_LIBRARY_PATH=/opt/ecl/lib`],cwd:`/home/user`,uid:1e3,gid:1e3},I=`/opt/actr-mailbox/actr-mailbox.sh`;function L(){return(typeof globalThis<`u`?globalThis.__ACTR_CHEERPX_IMAGE__:void 0)||O}async function R(e){let t=`${e}.meta`;try{return(await fetch(t,{method:`HEAD`})).ok?!0:(await fetch(t,{method:`GET`})).ok}catch{return!1}}async function z(e){try{if((await fetch(e,{method:`HEAD`})).ok)return!0;let t=await fetch(e,{method:`GET`,headers:{Range:`bytes=0-0`}});return t.ok||t.status===206}catch{return!1}}async function B(e,t){if(await R(t))return E.info(`Loading ACT-R disk image (GitHubDevice chunks)…`),e.GitHubDevice.create(t);if(await z(t))return E.info(`Loading ACT-R disk image (HttpBytesDevice flat ext2)…`),e.HttpBytesDevice.create(t);throw Error(`ACT-R CheerpX image not found at ${t} — run npm run cheerpx:build-image in extension-actr`)}function V(e,t){E.info(t),e?.(t)}function H(e,t){return t.error?`${e}: ERROR ${typeof t.error==`string`?t.error:t.error.message??JSON.stringify(t.error)}`:`${e}: ${JSON.stringify(t.result)}`}function U(e,t){if(t.error){let n=typeof t.error==`string`?t.error:t.error.message??JSON.stringify(t.error);throw Error(`${e} failed: ${n}`)}}async function W(e,t,n,r){U(`write-begin`,await e.call(`write-begin`,[t]));let i=Math.max(1,Math.ceil(n.length/P));for(let t=0,a=0;t<n.length;t+=P,a+=1){let o=n.slice(t,t+P);V(r,`Staging model… chunk ${a+1}/${i}`),U(`write-chunk`,await e.call(`write-chunk`,[o]))}U(`write-end`,await e.call(`write-end`,[]))}var G=new class{constructor(){this.consoleLog=``,this.consoleDecoder=new TextDecoder(`utf-8`),this.operation=Promise.resolve()}reset(){this.ready=void 0,this.mailbox=void 0,this.consoleLog=``}getConsoleText(){return this.consoleLog}async bootstrap(e){V(e,`Loading CheerpX…`);let t=await _(()=>import(D),[]);V(e,`Loading ACT-R disk image…`);let n=await B(t,L()),r=await t.IDBDevice.create(k),i=await t.OverlayDevice.create(n,r),a=await t.DataDevice.create(),o=await t.IDBDevice.create(A);V(e,`Starting Linux…`);let s=await t.Linux.create({mounts:[{type:`ext2`,path:`/`,dev:i},{type:`devs`,path:`/dev`},{type:`proc`,path:`/proc`},{type:`dir`,path:j,dev:a},{type:`dir`,path:M,dev:o}]});this.consoleLog=``,s.setCustomConsole(e=>{this.consoleLog+=this.consoleDecoder.decode(e)},80,24),V(e,`Starting ACT-R mailbox…`);let c=null;s.run(I,[],F).catch(e=>{c=e instanceof Error?e:Error(String(e)),E.error(`mailbox exited: ${c.message}`)});let l=T({inDevice:a,outDevice:o,timeoutMs:18e4}),u=await l.waitUntilReady({timeoutMs:6e5,pollMs:250,onProgress:t=>V(e,`ACT-R: ${t}`),onPoll:()=>{if(c)throw c;let e=this.consoleLog.match(/ELF execution failed[^\n]*/);if(e)throw Error(e[0])}});return E.info(`mailbox ready (${u})`),this.mailbox=l,{mailbox:l,version:u}}ensureReady(e){return this.mailbox?(V(e,`ACT-R runtime ready`),Promise.resolve({mailbox:this.mailbox,version:``})):(this.ready||=this.bootstrap(e).catch(e=>{throw E.error(e instanceof Error?e.message:String(e)),this.reset(),e}),this.ready)}enqueue(e){let t=this.operation.then(e,e);return this.operation=t.then(()=>void 0,()=>void 0),t}runLisp(e,t={}){let n=t.seconds??10,r=t.onProgress;return this.enqueue(async()=>{let{mailbox:t}=await this.ensureReady(r),i=this.getConsoleText().length;V(r,`Staging model (${e.length} chars)…`),await W(t,N,e,r),V(r,`Resetting ACT-R…`);let a=await t.evaluate(`reset`,!1);a.error&&E.warn(H(`reset`,a)),V(r,`Loading model…`);let o=await t.call(`load-model`,[N]);U(`load-model`,o),E.info(H(`load-model`,o)),V(r,`Running for ${n}s…`);let s=await t.evaluate(`run`,!1,n);U(`run`,s),E.info(H(`run`,s));let c=this.getConsoleText().slice(i),l=await t.evaluate(`act-r-version`,!1),u=Array.isArray(l.result)&&l.result[0]!=null?String(l.result[0]):``;return V(r,`Done`),{version:u,load:o,run:s,console:c}})}},K=/(?<![\n\r])(?=\d+\.\d{3}\s)/g;function q(e){return e.replace(/\r\n?/g,`
`).replace(K,`
`).replace(/^\n+/,``).trimEnd()}var J=`actr-editor`,Y=`actr-companion-update`,X=class extends p{constructor(...e){super(...e),this.loading=!1,this.running=!1,this.runStatus=``,this.textTrace=``,this.widgetRef=u(),this.isEditor=!0,this.scrollMode=`native`,this.onContentChange=()=>{this.markDirty(!0)},this.onRun=async()=>{if(!this.canRun)return;let e=this.widgetRef.value?.getContent?.()??this.initialContent??``;if(!e.trim()){this.runStatus=`Nothing to run`,this.textTrace=``;return}this.running=!0,this.runStatus=`Starting…`,this.textTrace=``;try{let t=await G.runLisp(e,{seconds:10,onProgress:e=>{this.runStatus=e}}),n=[t.version?`ACT-R ${t.version}`:null,`load → ${JSON.stringify(t.load.result)}`,`run  → ${JSON.stringify(t.run.result)}`].filter(Boolean);this.textTrace=q(t.console),this.runStatus=n.join(` · `)||`Done`}catch(e){this.runStatus=`Failed`,this.textTrace=e instanceof Error?e.message:String(e)}finally{this.running=!1}}}updated(e){super.updated?.(e);let t=new Set([`runStatus`,`textTrace`,`running`,`loading`]);[...e.keys()].some(e=>t.has(e))&&this.dispatchEvent(new CustomEvent(Y))}getCompanionTraceSnapshot(){return{status:this.runStatus,textTrace:this.textTrace,running:this.running,canRun:this.canRun}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0,this.runStatus=``,this.textTrace=``;try{let e=this.input?.data;if(!(e instanceof t))throw Error(`No file input available`);let n=await e.getContents(),r=typeof n==`string`?n:new TextDecoder().decode(n);this.initialContent=r,this.uri=e.getWorkspacePath()}catch(e){this.error=e instanceof Error?e.message:String(e)}finally{this.loading=!1}}save(){let e=this.input?.data;if(!(e instanceof t))return;let n=this.widgetRef.value?.getContent?.()??``;e.saveContents(n),this.markDirty(!1)}get language(){return this.uri?.toLowerCase().endsWith(`.lisp`)?`actr-lisp`:`plaintext`}get canRun(){return this.language===`actr-lisp`&&!this.running&&!this.loading}renderToolbar(){let e=this.language===`actr-lisp`?`Load model into in-browser ACT-R and run for 10s`:`Run is only available for .lisp ACT-R models`;return s`
      <wa-button
        appearance="plain"
        size="s"
        ?disabled=${!this.canRun}
        title=${e}
        @click=${this.onRun}
      >
        <wa-icon name="play" slot="prefix"></wa-icon>
        ${this.running?`Running…`:`Run`}
      </wa-button>
    `}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?s`<div class="state state-error">${this.error}</div>`:this.loading?s`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?s`<div class="editor-placeholder"></div>`:s`
      <div class="editor-container">
        <docks-monaco-widget
          .value=${this.initialContent}
          .uri=${this.uri}
          language=${this.language}
          @content-change=${this.onContentChange}
          ${n(this.widgetRef)}
        ></docks-monaco-widget>
      </div>
    `}static{this.styles=h`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    :host .part-shell {
      flex: 1;
      min-height: 0;
    }

    :host .part-content-inner {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .editor-container {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .editor-container docks-monaco-widget {
      display: block;
      height: 100%;
      width: 100%;
    }

    .editor-placeholder {
      flex: 1;
      min-height: 0;
    }

    .state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--wa-space-m, 1rem);
      box-sizing: border-box;
    }

    .state-error {
      color: var(--wa-color-danger-fill-loud);
    }
  `}};l([m({attribute:!1})],X.prototype,`input`,void 0),l([a()],X.prototype,`loading`,void 0),l([a()],X.prototype,`error`,void 0),l([a()],X.prototype,`initialContent`,void 0),l([a()],X.prototype,`uri`,void 0),l([a()],X.prototype,`running`,void 0),l([a()],X.prototype,`runStatus`,void 0),l([a()],X.prototype,`textTrace`,void 0),X=l([g(`ns-actr-editor`)],X);function Z(){let e=i.get();return e instanceof X?e:null}var Q=class extends p{constructor(...e){super(...e),this._companionEditor=null,this._onCompanionUpdate=()=>this.requestUpdate()}static{this.styles=h`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .status {
      flex-shrink: 0;
      padding: 0.35rem var(--wa-space-m, 0.75rem);
      font-size: 0.8125rem;
      color: var(--wa-color-text-quiet, #aaa);
      border-bottom: 1px solid var(--wa-color-surface-border, #333);
    }

    .trace {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: var(--wa-space-m, 0.75rem);
      overflow: auto;
      overflow-x: auto;
      white-space: pre;
      word-break: normal;
      tab-size: 4;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
      color: var(--wa-color-text-normal, #ddd);
    }

    .placeholder {
      padding: var(--wa-space-m, 0.75rem);
      color: var(--wa-color-text-quiet, #aaa);
      font-style: italic;
      font-size: 0.875rem;
    }
  `}doBeforeUI(){this.watch(i,()=>{this.syncCompanionListener(),this.requestUpdate()}),this.syncCompanionListener()}disconnectedCallback(){this.detachCompanionListener(),super.disconnectedCallback()}syncCompanionListener(){let e=Z();e!==this._companionEditor&&(this.detachCompanionListener(),this._companionEditor=e,e?.addEventListener(Y,this._onCompanionUpdate))}detachCompanionListener(){this._companionEditor?.removeEventListener(Y,this._onCompanionUpdate),this._companionEditor=null}renderToolbar(){return d}renderContent(){let e=Z();if(!e)return s`
        <div class="panel-content">
          <div class="placeholder">Open an ACT-R model (.lisp) to see the text trace</div>
        </div>
      `;let t=e.getCompanionTraceSnapshot(),n=t.status||(t.running?`Running…`:`Ready`),r=q(t.textTrace);return s`
      <div class="panel-content">
        <div class="status">${n}</div>
        ${r?s`<pre class="trace">${r}</pre>`:s`<div class="placeholder">
              Click Run in the editor toolbar to load this model into ACT-R. First boot can take several minutes.
            </div>`}
      </div>
    `}};Q=l([g(`actr-text-trace-panel`)],Q),r.registerContribution(o,{name:`actr-text-trace`,label:`Text Trace`,icon:`align-left`,coupledEditors:[J],component:e=>s`<actr-text-trace-panel id="${e}"></actr-text-trace-panel>`}),c({name:`attribution.act-r`,label:`ACT-R`,component:()=>s`
    <p>
      Tutorial content and models are from the
      <a href="https://act-r.psy.cmu.edu/software/" target="_blank" rel="noopener noreferrer"
        >ACT-R 7 software</a
      >
      distributed by the ACT-R Research Group, Carnegie Mellon University.
    </p>
  `}),y({label:`ACT-R`,icon:`brain`,contributionId:`actr.tutorial`,items:[{label:`Tutorial archive`,icon:`file-zipper`,contributionId:`actr.tutorial.archive`,items:[{label:`ACT-R 7 tutorial (zip)`,icon:`file-arrow-down`,state:{url:`https://act-r.psy.cmu.edu/actr7.x/units.zip`,filename:`units.zip`,openInNewTab:!0}}]}]});var $=e=>e.getName().toLowerCase().endsWith(`.lisp`);f.registerEditorInputHandler({editorId:J,label:`ACT-R Editor`,canHandle:e=>e instanceof t&&$(e),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:`actr-editor-${e.getWorkspacePath()}`,icon:`brain`,state:{},component:e=>s`<ns-actr-editor id="${e}" .input=${t}></ns-actr-editor>`};return t},ranking:2e3});