import"./monaco-widget-bVmeI1xu-BaKwph4B.js";import{A as e,hn as t}from"./dist-Bn8DfJpU.js";import{H as n,M as r,P as i,Z as a,j as o,n as s,r as c}from"./repeat-DrIoLvfh.js";var l=class extends e{constructor(...e){super(...e),this.readOnly=!1,this.initialContent=void 0,this.initialUri=void 0,this.initialLanguage=void 0,this.widgetRef=s(),this._onContentChange=()=>{this.markDirty(!0)}}async doInitUI(){let e=this.input.data,t=await e.getContents();this.initialContent=t,this.initialUri=e.getWorkspacePath(),this.initialLanguage=void 0,this.requestUpdate()}getEditor(){return this.widgetRef.value?.getEditor()??void 0}save(){let e=this.widgetRef.value?.getContent()??``;this.input?.data.saveContents(e),this.markDirty(!1)}doClose(){this.widgetRef.value?.dispose()}getLanguage(){return this.widgetRef.value?.getLanguage()??null}isLanguage(e){return this.widgetRef.value?.isLanguage(e)??!1}getContent(){return this.widgetRef.value?.getContent()??null}getSelection(){return this.widgetRef.value?.getSelection()??null}getSnippet(e=5){return this.widgetRef.value?.getSnippet(e)??null}getFilePath(){return this.input?.data?.getWorkspacePath()??null}renderContent(){return this.initialContent===void 0?n`<div class="monaco-editor-placeholder"></div>`:n`
            <docks-monaco-widget
                .value=${this.initialContent}
                .uri=${this.initialUri}
                .language=${this.initialLanguage}
                .readOnly=${this.readOnly}
                @content-change=${this._onContentChange}
                ${c(this.widgetRef)}
            ></docks-monaco-widget>
        `}static{this.styles=a`
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
    `}};t([r({attribute:!1})],l.prototype,`input`,void 0),t([r()],l.prototype,`readOnly`,void 0),t([o()],l.prototype,`initialContent`,void 0),t([o()],l.prototype,`initialUri`,void 0),t([o()],l.prototype,`initialLanguage`,void 0),l=t([i(`docks-monaco-editor`)],l);