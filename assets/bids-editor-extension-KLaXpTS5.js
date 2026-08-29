import{n as e}from"./fs-access-Cjcg0_Me-BYL2BwWI.js";import{A as t,O as n,a as r,at as i,dt as a,ft as o,it as s,k as c,n as l,ot as u}from"./dist-CE3uCmPT.js";import{t as d}from"./contributions-3pl8RjZl.js";import"./lit-CmpdDpZW.js";var f=class extends r{constructor(...e){super(...e),this.loading=!1,this.widgetRef=n(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{let t=this.input?.data;if(!(t instanceof e))throw Error(`No file input available`);let n=await t.getContents(),r=typeof n==`string`?n:new TextDecoder().decode(n);this.initialContent=r,this.uri=t.getWorkspacePath()}catch(e){this.error=e instanceof Error?e.message:String(e)}finally{this.loading=!1}}save(){let t=this.input?.data;if(!(t instanceof e))return;let n=this.widgetRef.value?.getContent?.()??``;t.saveContents(n),this.markDirty(!1)}renderToolbar(){return a`
      <docks-command
        icon="clipboard-list"
        title="Validate"
        dropdown=${d}
        with-caret
        label
        appearance="plain"
        size="s"
      ></docks-command>
    `}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?a`<div class="state state-error">${this.error}</div>`:this.loading?a`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?a`<div class="monaco-editor-placeholder"></div>`:a`
      <docks-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${c(this.widgetRef)}
      ></docks-monaco-widget>
    `}static{this.styles=o`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
      height: 100%;
    }
    .monaco-editor-placeholder {
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
      color: var(--wa-color-danger-70, #b42318);
    }
  `}};t([i({attribute:!1})],f.prototype,`input`,void 0),t([s()],f.prototype,`loading`,void 0),t([s()],f.prototype,`error`,void 0),t([s()],f.prototype,`initialContent`,void 0),t([s()],f.prototype,`uri`,void 0),f=t([u(`k-bids-editor`)],f);var p=e=>e.getName()===`dataset_description.json`;l.registerEditorInputHandler({editorId:`bids-editor`,label:`BIDS Editor`,canHandle:t=>t instanceof e&&p(t),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:`bids-editor-${e.getWorkspacePath()}`,icon:`pencil`,state:{},component:e=>a`<k-bids-editor id="${e}" .input=${t}></k-bids-editor>`};return t},ranking:1e3});