import{f as e,p as t}from"./fs-access-Cjcg0_Me-BYL2BwWI.js";import{A as n,B as r,E as i,F as a,L as o,R as s,S as c,at as l,ft as u,j as d,k as f,l as p,o as m,pt as h,st as g}from"./dist-Be2v51rR.js";import"./lit-Cpjx5qc7.js";var _,v=`catalog.root`,y=`No catalog entries yet. Install or enable extensions that contribute catalog items.`,b=class extends m{static{_=this}constructor(...e){super(...e),this.treeRef=f()}doBeforeUI(){this.rebuildTree(),this.contributionsSubscriptionToken=e(a,e=>{(e.target===`catalog.root`||e.target?.startsWith(`catalog.`))&&this.rebuildTree()})}doClose(){this.contributionsSubscriptionToken&&=(t(this.contributionsSubscriptionToken),void 0),super.doClose()}rebuildTree(){let e=r.getContributions(v);this.rootNodes=this.toTreeNodes(e),this.requestUpdate()}renderToolbar(){let e=o.get()instanceof _&&s.get()!==void 0;return u`
            <docks-command
                icon="file-arrow-down"
                title="Checkout"
                ?disabled=${!e}
                .action=${()=>this.runWgetForSelection()}
            ></docks-command>
            <docks-command icon="arrows-rotate" title="Refresh Catalog" .action=${()=>this.refresh()}></docks-command>
            <docks-command icon="angles-down" slot="end" title="Expand All" .action=${()=>this.setAllExpanded(!0)}></docks-command>
            <docks-command icon="angles-up" slot="end" title="Collapse All" .action=${()=>this.setAllExpanded(!1)}></docks-command>
        `}toTreeNodes(e){return e.map(e=>{let t={data:e.state,icon:e.icon,label:e.label,leaf:!1};if(e.contributionId){let n=r.getContributions(e.contributionId);t.leaf=n.length===0,t.children=this.toTreeNodes(n)}return t})}wgetParamsFromCatalogData(e){if(!e?.url)return null;let t={url:e.url};return typeof e.filename==`string`&&e.filename.trim()&&(t.filename=e.filename.trim()),t}onItemDblClicked(e){let t=e.currentTarget,n=t?.model;if(!n)return;let r=this.wgetParamsFromCatalogData(n.data);if(r){this.executeCommand(`wget`,r);return}!n.leaf&&`expanded`in t&&(t.expanded=!t.expanded)}runWgetForSelection(){let e=s.get(),t=e&&this.wgetParamsFromCatalogData(e);t&&this.executeCommand(`wget`,t)}onSelectionChanged(e){let t=e.detail.selection[0].model;s.set(t.data)}renderContextMenu(){let e=o.get()instanceof _?s.get():void 0,t=e&&`url`in e&&e.url;return u`
            ${i({icon:`file-arrow-down`,label:`Checkout`,title:`Checkout`,disabled:!t,action:()=>this.runWgetForSelection()})}
        `}setAllExpanded(e){let t=this.treeRef.value;t&&t.querySelectorAll(`wa-tree-item`).forEach(t=>{t.expanded=e})}refresh(){this.rebuildTree()}createTreeItems(e,t=!1){return e?u`
            <wa-tree-item
                @dblclick=${this.nobubble(this.onItemDblClicked)}
                .model=${e}
                ?expanded=${t}
            >
                <span>${c(e.icon)} ${e.label}</span>
                ${e.children?.map(e=>this.createTreeItems(e))}
            </wa-tree-item>
        `:u``}renderContent(){let e=(this.rootNodes?.length??0)>0;return u`
            <div class="catalog-root">
                ${e?u`
                          <wa-tree
                              ${n(this.treeRef)}
                              @wa-selection-change=${this.nobubble(this.onSelectionChanged)}
                              style="--indent-guide-width: 1px;"
                          >
                              ${this.rootNodes.map(e=>this.createTreeItems(e,!0))}
                          </wa-tree>
                      `:u`
                          <docks-no-content
                              message=${y}
                              icon="book"
                          ></docks-no-content>
                      `}
            </div>
        `}static{this.styles=h`
        :host {
            display: flex;
            flex-direction: column;
        }

        .catalog-root {
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .catalog-root wa-tree {
            flex: 1;
            min-height: 0;
        }
    `}};d([l()],b.prototype,`rootNodes`,void 0),b=_=d([g(`docks-catalog`)],b),r.registerContribution(p,{name:`catalog`,label:`Catalog`,icon:`book`,component:e=>u`<docks-catalog id="${e}"></docks-catalog>`});