import{r as e}from"./fs-access-CQjv2ahQ-DRM5ceXp.js";import{A as t,Ot as n,hn as r,in as i,l as a,tn as o}from"./dist-Bn8DfJpU.js";import{H as s,M as c,O as l,P as u,R as d,Z as f,j as p,p as m}from"./repeat-DrIoLvfh.js";import"./widget-COfkL_p2.js";a.registerEditorInputHandler({editorId:`system.md-editor`,label:`Markdown`,icon:`book`,canHandle:t=>t instanceof e&&t.getName().toLowerCase().endsWith(`.md`),handle:async e=>{let t={title:e.getWorkspacePath(),data:e,key:e.getWorkspacePath(),icon:`book`,state:{}};return t.component=e=>s`
            <docks-md-editor id="${e}" .input=${t}></docks-md-editor>`,t},ranking:1e3});var h=class extends t{constructor(...t){super(...t),this.ready=!1,this.mode=`preview`,this.rendered=``,this.sourceText=``,this.sourceUri=`markdown.md`,this.onContentChange=()=>{let t=this.widget?.getContent()??this.sourceText;t!==this.sourceText&&(this.sourceText=t,this.input?.data instanceof e&&this.markDirty(!0))}}async doInitUI(){let t=this.input?.data;t instanceof e?(this.sourceText=String(await t.getContents()??``),this.sourceUri=t.getWorkspacePath()):typeof t==`string`&&t.startsWith(`http`)?(this.sourceText=await(await fetch(t)).text(),this.sourceUri=`remote.md`):typeof t==`string`&&(this.sourceText=t),this.rendered=n(this.sourceText),this.mode=this.input?.state?.mode===`source`?`source`:`preview`,this.scrollMode=this.mode===`source`?`none`:`scroller`,this.ready=!0}doClose(){this.widget?.dispose(),this.input=void 0,this.sourceText=``,this.rendered=``,this.ready=!1}updated(e){super.updated(e),this.mode===`source`&&this.widget?.layout()}async save(){let t=this.getContent()??``,r=this.input?.data;r instanceof e&&await r.saveContents(t),this.rendered=n(t),this.markDirty(!1)}getContent(){return this.widget?.getContent()??this.sourceText}getSelection(){return this.widget?.getSelection()??null}getSnippet(e=5){return this.widget?.getSnippet(e)??null}getLanguage(){return`markdown`}isLanguage(e){return e.toLowerCase()===`markdown`}getFilePath(){let t=this.input?.data;return t instanceof e?t.getWorkspacePath():null}async reloadFromFile(){let t=this.input?.data;if(!(t instanceof e))return;let r=String(await t.getContents()??``);this.sourceText=r,this.rendered=n(r),this.widget?.getModel()?.setValue(r),this.markDirty(!1)}isPlanFile(){let e=this.getFilePath();if(!e)return!1;let t=e.split(/[/\\]/).pop()??``;return/^plan-.+\.plan\.md$/i.test(t)}async buildPlan(){let e=this.getFilePath();e&&o.hasCommand(`build_plan`)&&(this.isDirty()&&await this.save(),await o.execute(`build_plan`,o.createExecutionContext({path:e})))}toggleMode(){this.sourceText=this.widget?.getContent()??this.sourceText;let e=this.mode===`preview`?`source`:`preview`;this.mode=e,this.input&&(this.input.state.mode=e),this.scrollMode=e===`source`?`none`:`scroller`,e===`preview`&&(this.rendered=n(this.sourceText))}renderToolbar(){if(!this.ready)return d;let e=this.mode===`preview`,t=e?`Source`:`Preview`,n=this.isPlanFile()&&o.hasCommand(`build_plan`);return s`
            ${n?s`
                    <wa-button appearance="plain" size="s" title="Build this plan" @click=${()=>void this.buildPlan()}>
                        ${i(`play`,{slot:`start`})}
                        Build
                    </wa-button>
                `:d}
            <wa-button appearance="plain" size="s" title=${t} @click=${()=>this.toggleMode()}>
                ${i(e?`code`:`eye`,{slot:`start`})}
                ${t}
            </wa-button>
        `}renderContent(){if(!this.ready)return s``;let t=this.mode===`preview`;return s`
            <div class="md-preview ${t?``:`md-hidden`}">${m(this.rendered)}</div>
            <docks-monaco-widget
                class=${t?`md-hidden`:``}
                .value=${this.sourceText}
                .language=${`markdown`}
                .uri=${this.sourceUri}
                .readOnly=${!(this.input?.data instanceof e)}
                @content-change=${this.onContentChange}>
            </docks-monaco-widget>
        `}static{this.styles=f`
        :host {
            display: block;
            height: 100%;
            min-height: 0;
        }
        .md-preview {
            padding: var(--wa-space-m, 0.75rem);
            box-sizing: border-box;
        }
        .md-preview.md-hidden, docks-monaco-widget.md-hidden { display: none; }
        docks-monaco-widget { display: block; height: 100%; min-height: 0; }
    `}};r([c({attribute:!1})],h.prototype,`input`,void 0),r([p()],h.prototype,`ready`,void 0),r([p()],h.prototype,`mode`,void 0),r([p()],h.prototype,`rendered`,void 0),r([l(`docks-monaco-widget`)],h.prototype,`widget`,void 0),h=r([u(`docks-md-editor`)],h);export{h as DocksMDEditor};