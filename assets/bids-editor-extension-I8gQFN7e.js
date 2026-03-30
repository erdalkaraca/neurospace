import{n as e}from"./fs-access-DHrXww7b-DkktKkYZ.js";import{D as t,E as n,M as r,N as i,P as a,T as o,a as s,ct as c,lt as l,n as u}from"./dist-CW5PPpr9.js";import"./lit-CgiwPcN7.js";var d=class extends s{constructor(...e){super(...e),this.loading=!1,this.widgetRef=o(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{let t=this.input?.data;if(!(t instanceof e))throw Error(`No file input available`);let n=await t.getContents();this.initialContent=typeof n==`string`?n:new TextDecoder().decode(n),this.uri=t.getWorkspacePath()}catch(e){this.error=e instanceof Error?e.message:String(e)}finally{this.loading=!1}}save(){let t=this.input?.data;if(!(t instanceof e))return;let n=this.widgetRef.value?.getContent?.()??``;t.saveContents(n),this.markDirty(!1)}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?c`<div class="state state-error">${this.error}</div>`:this.loading?c`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?c`<div class="monaco-editor-placeholder"></div>`:c`
      <lyra-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${n(this.widgetRef)}
      ></lyra-monaco-widget>
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
  `}};t([i({attribute:!1})],d.prototype,`input`,void 0),t([r()],d.prototype,`loading`,void 0),t([r()],d.prototype,`error`,void 0),t([r()],d.prototype,`initialContent`,void 0),t([r()],d.prototype,`uri`,void 0),d=t([a(`k-bids-editor`)],d);var f=e=>e.getName()===`dataset_description.json`;u.registerEditorInputHandler({editorId:`bids-editor`,label:`BIDS Editor`,canHandle:t=>t instanceof e&&f(t),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:`bids-editor-${e.getWorkspacePath()}`,icon:`pencil`,state:{},component:e=>c`<k-bids-editor id="${e}" .input=${t}></k-bids-editor>`};return t},ranking:1e3});