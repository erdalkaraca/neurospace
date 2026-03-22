import{d as p,n as g,r as d,L as f,k as u,F as h,b as a,l as v,t as y,c as w}from"./config-BohSmpxh-C7pCp9CA.js";var m=Object.defineProperty,b=Object.getOwnPropertyDescriptor,o=(t,e,r,s)=>{for(var n=s>1?void 0:s?b(e,r):e,l=t.length-1,c;l>=0;l--)(c=t[l])&&(n=(s?c(e,r,n):c(n))||n);return s&&n&&m(e,r,n),n};let i=class extends f{constructor(){super(...arguments),this.loading=!1,this.widgetRef=u(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{const t=this.input?.data;if(!(t instanceof h))throw new Error("No file input available");const e=await t.getContents(),r=typeof e=="string"?e:new TextDecoder().decode(e);this.initialContent=r,this.uri=t.getWorkspacePath()}catch(t){this.error=t instanceof Error?t.message:String(t)}finally{this.loading=!1}}save(){const t=this.input?.data;if(!(t instanceof h))return;const e=this.widgetRef.value?.getContent?.()??"";t.saveContents(e),this.markDirty(!1)}doClose(){this.widgetRef.value?.dispose?.()}renderContent(){return this.error?a`<div class="state state-error">${this.error}</div>`:this.loading?a`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?a`<div class="monaco-editor-placeholder"></div>`:a`
      <lyra-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${v(this.widgetRef)}
      ></lyra-monaco-widget>
    `}};i.styles=p`
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
  `;o([g({attribute:!1})],i.prototype,"input",2);o([d()],i.prototype,"loading",2);o([d()],i.prototype,"error",2);o([d()],i.prototype,"initialContent",2);o([d()],i.prototype,"uri",2);i=o([y("k-bids-editor")],i);const C=t=>t.getName()==="dataset_description.json";w.registerEditorInputHandler({editorId:"bids-editor",label:"BIDS Editor",canHandle:t=>t instanceof h&&C(t),handle:async t=>{const e={title:t.getWorkspacePath(),data:t,key:`bids-editor-${t.getWorkspacePath()}`,icon:"pencil",state:{},component:r=>a`<k-bids-editor id="${r}" .input=${e}></k-bids-editor>`};return e},ranking:1e3});
