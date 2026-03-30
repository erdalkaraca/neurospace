import{d as e,f as t}from"./fs-access-DHrXww7b-DkktKkYZ.js";import{D as n,E as r,I as i,M as a,P as o,R as s,T as c,V as l,a as u,b as d,c as f,ct as p,lt as m,z as h}from"./dist-BtHoxARz.js";import"./lit-DxAbXMh6.js";var g,_=`catalog.root`,v=class extends u{static{g=this}constructor(...e){super(...e),this.treeRef=c()}doBeforeUI(){this.rebuildTree(),this.contributionsSubscriptionToken=e(i,e=>{(e.target===`catalog.root`||e.target?.startsWith(`catalog.`))&&this.rebuildTree()})}doClose(){this.contributionsSubscriptionToken&&=(t(this.contributionsSubscriptionToken),void 0),super.doClose()}rebuildTree(){let e=l.getContributions(_);this.rootNodes=this.toTreeNodes(e),this.requestUpdate()}renderToolbar(){return p`
            <lyra-command
                icon="file-arrow-down"
                title="Checkout"
                ?disabled=${!(s.get()instanceof g&&h.get()!==void 0)}
                .action=${()=>this.runWgetForSelection()}
            ></lyra-command>
            <lyra-command icon="arrows-rotate" title="Refresh Catalog" .action=${()=>this.refresh()}></lyra-command>
            <lyra-command icon="angles-down" slot="end" title="Expand All" .action=${()=>this.setAllExpanded(!0)}></lyra-command>
            <lyra-command icon="angles-up" slot="end" title="Collapse All" .action=${()=>this.setAllExpanded(!1)}></lyra-command>
        `}toTreeNodes(e){return e.map(e=>{let t={data:e.state,icon:e.icon,label:e.label,leaf:!1};if(e.contributionId){let n=l.getContributions(e.contributionId);t.leaf=n.length===0,t.children=this.toTreeNodes(n)}return t})}wgetParamsFromCatalogData(e){if(!e?.url)return null;let t={url:e.url};return typeof e.filename==`string`&&e.filename.trim()&&(t.filename=e.filename.trim()),t}onItemDblClicked(e){let t=e.currentTarget,n=t?.model;if(!n)return;let r=this.wgetParamsFromCatalogData(n.data);if(r){this.executeCommand(`wget`,r);return}!n.leaf&&`expanded`in t&&(t.expanded=!t.expanded)}runWgetForSelection(){let e=h.get(),t=e&&this.wgetParamsFromCatalogData(e);t&&this.executeCommand(`wget`,t)}onSelectionChanged(e){let t=e.detail.selection[0].model;h.set(t.data)}renderContextMenu(){let e=s.get()instanceof g?h.get():void 0;return p`
            <lyra-command
                icon="file-arrow-down"
                title="Checkout"
                ?disabled=${!(e&&`url`in e&&e.url)}
                .action=${()=>this.runWgetForSelection()}
            >Checkout</lyra-command>
        `}setAllExpanded(e){let t=this.treeRef.value;t&&t.querySelectorAll(`wa-tree-item`).forEach(t=>{t.expanded=e})}refresh(){this.rebuildTree()}createTreeItems(e,t=!1){return e?p`
            <wa-tree-item
                @dblclick=${this.nobubble(this.onItemDblClicked)}
                .model=${e}
                ?expanded=${t}
            >
                <span>${d(e.icon)} ${e.label}</span>
                ${e.children?.map(e=>this.createTreeItems(e))}
            </wa-tree-item>
        `:p``}renderContent(){return p`
            <wa-tree
                ${r(this.treeRef)}
                @wa-selection-change=${this.nobubble(this.onSelectionChanged)}
                style="--indent-guide-width: 1px;"
            >
                ${this.rootNodes?.map(e=>this.createTreeItems(e,!0))}
            </wa-tree>
        `}static{this.styles=m`
        :host {
            display: flex;
            flex-direction: column;
        }
    `}};n([a()],v.prototype,`rootNodes`,void 0),v=g=n([o(`lyra-catalog`)],v),l.registerContribution(f,{name:`catalog`,label:`Catalog`,icon:`book`,component:e=>p`<lyra-catalog id="${e}"></lyra-catalog>`});