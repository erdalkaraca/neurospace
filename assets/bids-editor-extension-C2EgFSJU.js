import{n as e}from"./fs-access-Cjcg0_Me-BYL2BwWI.js";import{A as t,at as n,ft as r,j as i,k as a,n as o,o as s,ot as c,pt as l,st as u}from"./dist-Be2v51rR.js";import{t as d}from"./contributions-3pl8RjZl.js";import"./lit-Cpjx5qc7.js";var f=class extends s{constructor(...e){super(...e),this.loading=!1,this.widgetRef=a(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{let t=this.input?.data;if(!(t instanceof e))throw Error(`No file input available`);let n=await t.getContents(),r=typeof n==`string`?n:new TextDecoder().decode(n);this.initialContent=r,this.uri=t.getWorkspacePath()}catch(e){this.error=e instanceof Error?e.message:String(e)}finally{this.loading=!1}}save(){let t=this.input?.data;if(!(t instanceof e))return;let n=this.widgetRef.value?.getContent?.()??``;t.saveContents(n),this.markDirty(!1)}renderToolbar(){return r`
      <docks-command
        icon="clipboard-list"
        title="Validate"
        dropdown=${d}
        with-caret
        label
        appearance="plain"
        size="s"
      ></docks-command>
    `}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?r`<div class="state state-error">${this.error}</div>`:this.loading?r`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?r`<div class="monaco-editor-placeholder"></div>`:r`
      <docks-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${t(this.widgetRef)}
      ></docks-monaco-widget>
    `}static{this.styles=l`
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
  `}};i([c({attribute:!1})],f.prototype,`input`,void 0),i([n()],f.prototype,`loading`,void 0),i([n()],f.prototype,`error`,void 0),i([n()],f.prototype,`initialContent`,void 0),i([n()],f.prototype,`uri`,void 0),f=i([u(`k-bids-editor`)],f);var p=e=>e.getName()===`dataset_description.json`;o.registerEditorInputHandler({editorId:`bids-editor`,label:`BIDS Editor`,canHandle:t=>t instanceof e&&p(t),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:`bids-editor-${e.getWorkspacePath()}`,icon:`pencil`,state:{},component:e=>r`<k-bids-editor id="${e}" .input=${t}></k-bids-editor>`};return t},ranking:1e3});