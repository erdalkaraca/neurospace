import{r as e}from"./fs-access-CQjv2ahQ-DRM5ceXp.js";import{A as t,hn as n,l as r}from"./dist-Bn8DfJpU.js";import{H as i,M as a,P as o,Z as s,j as c,n as l,r as u}from"./repeat-DrIoLvfh.js";import"./lit-D6r3CTy7.js";import"./widget-COfkL_p2.js";import{t as d}from"./contributions-3pl8RjZl.js";var f=class extends t{constructor(...e){super(...e),this.loading=!1,this.widgetRef=l(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{let t=this.input?.data;if(!(t instanceof e))throw Error(`No file input available`);let n=await t.getContents(),r=typeof n==`string`?n:new TextDecoder().decode(n);this.initialContent=r,this.uri=t.getWorkspacePath()}catch(e){this.error=e instanceof Error?e.message:String(e)}finally{this.loading=!1}}save(){let t=this.input?.data;if(!(t instanceof e))return;let n=this.widgetRef.value?.getContent?.()??``;t.saveContents(n),this.markDirty(!1)}renderToolbar(){return i`
      <docks-command
        icon="clipboard-list"
        title="Validate"
        dropdown=${d}
        with-caret
        label
        appearance="plain"
        size="s"
      ></docks-command>
    `}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?i`<div class="state state-error">${this.error}</div>`:this.loading?i`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?i`<div class="monaco-editor-placeholder"></div>`:i`
      <docks-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${u(this.widgetRef)}
      ></docks-monaco-widget>
    `}static{this.styles=s`
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
  `}};n([a({attribute:!1})],f.prototype,`input`,void 0),n([c()],f.prototype,`loading`,void 0),n([c()],f.prototype,`error`,void 0),n([c()],f.prototype,`initialContent`,void 0),n([c()],f.prototype,`uri`,void 0),f=n([o(`k-bids-editor`)],f);var p=e=>e.getName()===`dataset_description.json`;r.registerEditorInputHandler({editorId:`bids-editor`,label:`BIDS Editor`,canHandle:t=>t instanceof e&&p(t),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:`bids-editor-${e.getWorkspacePath()}`,icon:`pencil`,state:{},component:e=>i`<k-bids-editor id="${e}" .input=${t}></k-bids-editor>`};return t},ranking:1e3});