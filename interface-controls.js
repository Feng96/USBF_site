/* Panel preferences never remove layers, clear selections or cancel active jobs. */
(function(root){
 'use strict';
 const definitions=[
  ['sidebar','Layers / models','#sidebar','flex',false],
  ['attributes','Attribute table','#attribute-table','flex',true],
  ['properties','Feature details','#properties','block',true],
  ['legend','Map legend','#legend-card','block',false],
  ['search','Map search','#search-form','flex',false],
  ['navigation','Zoom and navigation','.map-controls','block',false],
  ['viewMode','2D / 3D controls','.map-mode','flex',false],
  ['scope','Data scope summary','#data-scope-bar','flex',false],
  ['dataWorkspace','Data and scope panel','#data-workspace-panel','flex',false],
  ['draw','Drawing controls','#drawing-strip','flex',true],
  ['measure','Measurement controls','#measure-card','flex',true],
  ['selection','Selection controls','.gis-selection-strip','flex',true],
  ['placeShortcuts','Place shortcuts','#explorer-quick-places','flex',false],
  ['neighborhood','Nearby building summary','#explorer-neighborhood','block',true],
  ['modelCaption','Model map caption','#model-map-caption','flex',true],
  ['location','Location caption','.map-place','flex',false],
  ['welcome','Workspace introduction','#welcome-card','block',false],
  ['statusbar','Coordinate status bar','.statusbar','flex',false],
  ['mapHints','Map interaction hints','.map-bottom-note','flex',false]
 ];
 const ids=definitions.map(d=>d[0]),modes=['auto','show','hide'],key='usbf-interface-layout-v1';
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),copy=v=>JSON.parse(JSON.stringify(v));
 function defaults(){return {version:1,density:'comfortable',sidebarWidth:'normal',sidebarTab:'layers',panels:Object.fromEntries(ids.map(id=>[id,'auto']))};}
 function validate(value){
  if(value===undefined||value===null)return defaults();
  if(!object(value)||Object.keys(value).some(k=>!['version','density','sidebarWidth','sidebarTab','panels'].includes(k))||value.version!==1||!['comfortable','compact'].includes(value.density)||!['narrow','normal','wide'].includes(value.sidebarWidth)||value.sidebarTab!==undefined&&!['layers','models','catalog'].includes(value.sidebarTab)||!object(value.panels)||Object.keys(value.panels).some(k=>!ids.includes(k)||!modes.includes(value.panels[k])))throw Error('The interface layout is invalid.');
  return {...defaults(),...copy(value),panels:{...defaults().panels,...copy(value.panels)}};
 }
 root.PortalInterfaceCore={defaults,validate,panels:ids.slice()};
 if(!root.document?.createElement)return;
 const $=s=>document.querySelector(s),t=s=>root.PortalI18n?.t(s)||s,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let state=defaults(),panel,scheduled=false,applying=false,observing=false;
 try{const saved=localStorage.getItem(key);if(saved)state=validate(JSON.parse(saved));}catch(_){}
 const entry=id=>definitions.find(d=>d[0]===id),attribute=id=>'data-interface-'+id.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
 function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}}
 function emit(){persist();document.dispatchEvent(new CustomEvent('portal-interface-changed',{detail:getState()}));document.dispatchEvent(new CustomEvent('portal-presentation-changed'));}
 function resize(){requestAnimationFrame(()=>root.portal?.map?.resize());}
 function isHidden(id){return state.panels[id]==='hide';}
 function visible(id){const def=entry(id),node=def&&$(def[2]);if(!node||isHidden(id))return false;if(id==='sidebar'&&root.PortalSidebar)return root.PortalSidebar.isOpen;return !node.hidden&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';}
 function setAttributes(){
  for(const id of ids){const name=attribute(id);if(document.body.getAttribute(name)!==state.panels[id])document.body.setAttribute(name,state.panels[id]);}
  document.body.setAttribute('data-interface-density',state.density);document.body.setAttribute('data-interface-sidebar-width',state.sidebarWidth);
  root.PortalSidebar?.refresh?.();
 }
 function reveal(id){
  const def=entry(id),node=def&&$(def[2]);if(!node)return;
  if(id==='sidebar'){root.PortalSidebar?.open(state.sidebarTab);return;}
  if(id==='dataWorkspace'){root.PortalDataWorkspace?.open();return;}
  if(id==='legend'){document.body.classList.add('legend-visible');node.hidden=false;return;}
  if(!def[4])node.hidden=false;
 }
 function set(id,value){
  if(!ids.includes(id)||!modes.includes(value))throw Error('Choose a valid interface panel.');
  state.panels[id]=value;setAttributes();if(value==='show')reveal(id);emit();decorate();renderRows();resize();const node=$(entry(id)[2]);if(value==='hide'&&node?.contains(document.activeElement))$('[data-interface-open]')?.focus({preventScroll:true});return getState();
 }
 function toggle(id){return set(id,isHidden(id)||!visible(id)?'show':'hide');}
 function getState(){const tab=root.PortalSidebar?.tab;if(['layers','models','catalog'].includes(tab))state.sidebarTab=tab;return copy(state);}
 function applyState(value,{notify=true}={}){
  applying=true;try{state=validate(value);setAttributes();const tab=$('[data-tab="'+state.sidebarTab+'"]');if(tab&&root.PortalSidebar?.tab!==state.sidebarTab)tab.click();for(const id of ids)if(state.panels[id]==='show')reveal(id);persist();decorate();renderRows();resize();}finally{applying=false;}
  if(notify)emit();return getState();
 }
 function reset(){return applyState(defaults());}
 function focusMap(){const next=getState();for(const id of ids)next.panels[id]=['navigation','viewMode'].includes(id)?'show':'hide';applyState(next);}
 function existingClose(id,node){
  if(id==='attributes')return node.querySelector('[data-action="table"]');
  if(id==='properties')return node.querySelector('[data-action="clear-selection"]');
  if(id==='welcome')return node.querySelector('[data-action="close-welcome"]');
  if(id==='dataWorkspace')return node.querySelector('[data-dw-close]');
  return null;
 }
 function decorate(){
  if(!document.body)return;
  for(const [id,label,selector] of definitions){
   const node=$(selector);if(!node)continue;const old=existingClose(id,node);
   if(old){if(!old.dataset.interfaceClose){old.dataset.interfaceClose=id;old.title='Hide panel';old.setAttribute('data-i18n-title','');}continue;}
   if(node.querySelector('[data-interface-close="'+id+'"]'))continue;
   const button=document.createElement('button');button.type='button';button.className='interface-panel-close';button.dataset.interfaceClose=id;button.textContent='×';button.setAttribute('aria-label','Hide panel');button.setAttribute('data-i18n-aria-label','');button.title='Hide panel';button.setAttribute('data-i18n-title','');button.dataset.interfacePanelName=label;
   const clear=id==='measure'?node.querySelector('[data-action="clear-measure"]'):null;if(clear){clear.textContent='Clear';clear.setAttribute('data-i18n','');}
   const back=id==='modelCaption'?node.querySelector('#close-model-view'):null;if(back){back.textContent='Return to footprint map';back.setAttribute('data-i18n','');}
   const holder=id==='sidebar'?node.querySelector('.sidebar-title>div'):node;holder?.append(button);node.classList.add('interface-managed-panel');
  }
 }
 function renderRows(){
  if(!panel)return;const list=panel.querySelector('[data-interface-list]');if(!list)return;
  for(const [id,,,,contextual] of definitions){const row=list.querySelector('[data-interface-row="'+id+'"]');if(!row)continue;const checkbox=row.querySelector('input');checkbox.checked=contextual?!isHidden(id):visible(id);const hint=row.querySelector('small'),text=state.panels[id]==='hide'?'Hidden until reopened':contextual&&!visible(id)?'Appears when this tool has content':visible(id)?'Visible':'Currently closed';if(hint.textContent!==t(text))hint.textContent=t(text);}
  panel.querySelector('[data-interface-density]').value=state.density;panel.querySelector('[data-interface-width]').value=state.sidebarWidth;
 }
 function ensure(){
  if(panel)return panel;panel=document.createElement('section');panel.id='interface-panel';panel.className='interface-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','interface-title');panel.innerHTML='<header><div><small data-i18n>WORKSPACE LAYOUT</small><h2 id="interface-title" data-i18n>Interface</h2></div><button type="button" data-interface-dismiss aria-label="Close interface settings" data-i18n-aria-label>×</button></header><div class="interface-body"><p data-i18n>Close panels without removing data or clearing selected features. Reopen them here.</p><div class="interface-shortcuts"><button type="button" data-interface-sidebar="layers" data-i18n>Layers</button><button type="button" data-interface-sidebar="models" data-i18n>Models</button><button type="button" data-interface-designer data-i18n>Map designer</button></div><fieldset><legend data-i18n>Panels and map tools</legend><div data-interface-list>'+definitions.map(([id,label])=>'<label data-interface-row="'+id+'"><input type="checkbox" data-interface-toggle="'+id+'"><span><b data-i18n>'+esc(label)+'</b><small></small></span></label>').join('')+'</div></fieldset><div class="interface-options"><label><span data-i18n>Interface density</span><select data-interface-density><option value="comfortable" data-i18n>Comfortable</option><option value="compact" data-i18n>Compact</option></select></label><label><span data-i18n>Contents width</span><select data-interface-width><option value="narrow" data-i18n>Narrow</option><option value="normal" data-i18n>Normal</option><option value="wide" data-i18n>Wide</option></select></label></div><div class="interface-actions"><button type="button" data-interface-focus data-i18n>Focus on map</button><button type="button" data-interface-reset data-i18n>Restore default layout</button></div><p class="interface-note" data-i18n>Use Interface in the toolbar to reopen hidden panels. Source attribution remains available on the map.</p></div>';document.body.append(panel);
  panel.addEventListener('change',event=>{if(event.target.dataset.interfaceToggle){set(event.target.dataset.interfaceToggle,event.target.checked?'show':'hide');}else if(event.target.matches('[data-interface-density]')){state.density=event.target.value;setAttributes();emit();resize();}else if(event.target.matches('[data-interface-width]')){state.sidebarWidth=event.target.value;setAttributes();emit();resize();}});
  panel.addEventListener('click',event=>{if(event.target.closest('[data-interface-dismiss]'))close();if(event.target.closest('[data-interface-reset]'))reset();if(event.target.closest('[data-interface-focus]'))focusMap();const sidebar=event.target.closest('button[data-interface-sidebar]');if(sidebar){state.sidebarTab=sidebar.dataset.interfaceSidebar;set('sidebar','show');}if(event.target.closest('[data-interface-designer]')){close();root.PortalComposer?.open('map');}});
  return panel;
 }
 function open(){const node=ensure();node.hidden=!node.hidden;document.querySelectorAll('details.tools-menu[open]').forEach(d=>d.open=false);for(const b of document.querySelectorAll('[data-interface-open]'))b.setAttribute('aria-expanded',String(!node.hidden));renderRows();if(!node.hidden)node.querySelector('[data-interface-dismiss]').focus();return !node.hidden;}
 function close(){if(panel)panel.hidden=true;for(const b of document.querySelectorAll('[data-interface-open]'))b.setAttribute('aria-expanded','false');}
 function queueSync(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();renderRows();if(!applying&&root.portal?.ready){const tab=root.PortalSidebar?.tab;if(tab&&tab!==state.sidebarTab){state.sidebarTab=tab;emit();}}});}
 function init(){if(observing||!document.body)return;observing=true;setAttributes();decorate();const observer=new MutationObserver(queueSync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-selected']});window.addEventListener('resize',queueSync);document.addEventListener('portal-ready',()=>{setAttributes();const tab=$('[data-tab="'+state.sidebarTab+'"]');if(tab&&root.PortalSidebar?.tab!==state.sidebarTab)tab.click();decorate();for(const id of ids)if(state.panels[id]==='show')reveal(id);});queueSync();}
 document.addEventListener('click',event=>{
  const closeButton=event.target.closest('[data-interface-close]');if(closeButton){event.preventDefault();event.stopImmediatePropagation();set(closeButton.dataset.interfaceClose,'hide');return;}
  if(event.target.closest('[data-interface-open]')){event.preventDefault();event.stopImmediatePropagation();open();return;}
  const sidebar=event.target.closest('[data-action="layers"],[data-open-models]');if(sidebar&&state.panels.sidebar!=='auto'){if(state.panels.sidebar==='hide')root.PortalSidebar?.close();state.panels.sidebar='auto';setAttributes();emit();}
  const table=event.target.closest('[data-action="table"]');if(table&&state.panels.attributes!=='auto'){const node=$('#attribute-table');if(node)node.hidden=state.panels.attributes==='hide';state.panels.attributes='auto';setAttributes();emit();}
  const legend=event.target.closest('[data-action="legend"]');if(legend&&state.panels.legend!=='auto'){document.body.classList.toggle('legend-visible',state.panels.legend==='show');state.panels.legend='auto';setAttributes();emit();}
  if(event.target.closest('[data-data-workspace]')&&state.panels.dataWorkspace==='hide'){state.panels.dataWorkspace='auto';setAttributes();emit();}
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();close();$('[data-interface-open]')?.focus();}},true);
 document.addEventListener('portal-language-changed',()=>{decorate();renderRows();});
 document.addEventListener('portal-data-workspace-open',()=>{if(state.panels.dataWorkspace==='hide')set('dataWorkspace','auto');});
 root.PortalInterface={getState,applyState,set,toggle,reset,open,close,focusMap,isHidden,visible,validateState:validate,panels:definitions.map(([id,label,selector,,contextual])=>({id,label,selector,contextual})),get isOpen(){return !!panel&&!panel.hidden;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
