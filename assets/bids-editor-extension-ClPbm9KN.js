import{d as g,n as p,r as d,L as f,k as u,F as h,b as s,l as v,t as y,c as w}from"./config-RT97oKMn-BO9Q0boL.js";var b=Object.defineProperty,C=Object.getOwnPropertyDescriptor,r=(t,e,o,a)=>{for(var n=a>1?void 0:a?C(e,o):e,l=t.length-1,c;l>=0;l--)(c=t[l])&&(n=(a?c(e,o,n):c(n))||n);return a&&n&&b(e,o,n),n};let i=class extends f{constructor(){super(...arguments),this.loading=!1,this.widgetRef=u(),this.isEditor=!0,this.onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){await this.loadContents()}async loadContents(){this.loading=!0,this.error=void 0,this.initialContent=void 0,this.uri=void 0;try{const t=this.input?.data;if(!(t instanceof h))throw new Error("No file input available");const e=await t.getContents(),o=typeof e=="string"?e:new TextDecoder().decode(e);this.initialContent=o,this.uri=t.getWorkspacePath()}catch(t){this.error=t instanceof Error?t.message:String(t)}finally{this.loading=!1}}save(){const t=this.input?.data;if(!(t instanceof h))return;const e=this.widgetRef.value?.getContent?.()??"";t.saveContents(e),this.markDirty(!1)}doClose(){this.widgetRef.value?.dispose?.()}render(){return this.error?s`<div class="state state-error">${this.error}</div>`:this.loading?s`<div class="state state-loading"><wa-spinner></wa-spinner></div>`:this.initialContent===void 0?s`<div class="content"></div>`:s`
      <div class="content">
        <lyra-monaco-widget
          .value=${this.initialContent}
          .uri=${this.uri}
          language="json"
          @content-change=${this.onContentChange}
          autoLayout
          ${v(this.widgetRef)}
        ></lyra-monaco-widget>
      </div>
    `}};i.styles=g`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .content {
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
  `;r([p({attribute:!1})],i.prototype,"input",2);r([d()],i.prototype,"loading",2);r([d()],i.prototype,"error",2);r([d()],i.prototype,"initialContent",2);r([d()],i.prototype,"uri",2);i=r([y("k-bids-editor")],i);const m=t=>t.getName()==="dataset_description.json";w.registerEditorInputHandler({editorId:"bids-editor",label:"BIDS Editor",canHandle:t=>t instanceof h&&m(t),handle:async t=>{const e={title:t.getWorkspacePath(),data:t,key:`bids-editor-${t.getWorkspacePath()}`,icon:"pencil",noOverflow:!1,state:{},component:()=>s`<k-bids-editor .input=${e}></k-bids-editor>`};return e},ranking:1e3});
