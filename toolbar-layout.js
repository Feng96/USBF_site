/* Menu presentation only: actions continue through the existing dispatchers. */
(function(root){
 'use strict';
 const selector='.compact-toolbar .toolbar-dropdown';
 const menus=()=>Array.from(document.querySelectorAll(selector));
 const trigger=menu=>menu?.querySelector(':scope > summary');
 const popup=menu=>menu?.querySelector(':scope > .toolbar-popover');
 const items=menu=>Array.from(popup(menu)?.querySelectorAll('button:not(:disabled),a[href]')||[]).filter(node=>!node.hidden&&node.getClientRects().length);
 let ready=false,frame;
 function setExpanded(menu){trigger(menu)?.setAttribute('aria-expanded',String(menu.open));}
 function close(menu,restore=false){
  if(!menu)return;menu.open=false;setExpanded(menu);if(restore)trigger(menu)?.focus({preventScroll:true});
 }
 function closeAll(except,restore=false){for(const menu of menus())if(menu!==except&&menu.open)close(menu,restore);}
 function place(menu){
  const panel=popup(menu),button=trigger(menu);if(!menu?.open||!panel||!button)return;
  const viewport=root.visualViewport,edge=8,viewLeft=viewport?.offsetLeft||0,viewTop=viewport?.offsetTop||0,width=viewport?.width||document.documentElement.clientWidth,height=viewport?.height||root.innerHeight;
  const rect=button.getBoundingClientRect(),toolbar=document.querySelector('.compact-toolbar').getBoundingClientRect();
  // Keep the popup below all wrapped menu rows, with space left to scroll.
  const top=Math.min(viewTop+height-edge-70,Math.max(rect.bottom+5,toolbar.bottom+4));
  panel.style.maxHeight=Math.max(70,viewTop+height-top-edge)+'px';
  panel.style.maxWidth=Math.max(0,width-edge*2)+'px';
  const panelWidth=panel.getBoundingClientRect().width;
  panel.style.left=Math.max(viewLeft+edge,Math.min(rect.left,viewLeft+width-panelWidth-edge))+'px';panel.style.top=Math.max(viewTop+edge,top)+'px';
 }
 function open(menu,focus){
  if(!menu)return;closeAll(menu);menu.open=true;setExpanded(menu);root.PortalLayerActions?.refresh?.();decorate(menu);place(menu);
  if(focus){const list=items(menu);(focus==='last'?list.at(-1):list[0])?.focus({preventScroll:true});}
 }
 function decorate(menu){
  for(const node of popup(menu)?.querySelectorAll('button,a[href]')||[])if(node.getAttribute('role')!=='menuitem')node.setAttribute('role','menuitem');
 }
 function update(){
  const toolbar=document.querySelector('.compact-toolbar');if(!toolbar)return;
  document.documentElement.style.setProperty('--portal-toolbar-bottom',Math.ceil(toolbar.getBoundingClientRect().bottom+6)+'px');
  for(const menu of menus()){setExpanded(menu);if(menu.open)place(menu);}
 }
 function queue(){if(frame)return;frame=root.requestAnimationFrame(()=>{frame=null;update();});}
 // Window capture runs before action registries that intentionally stop events.
 root.addEventListener('click',event=>{
  const menu=event.target.closest?.(selector),summary=event.target.closest?.('summary');
  if(menu&&summary===trigger(menu)){event.preventDefault();menu.open?close(menu):open(menu);return;}
  if(menu&&event.target.closest('button,a[href]')){
   const action=event.target.closest('button,a[href]');if(action.disabled)return;
   close(menu);queueMicrotask(()=>{if(menu.contains(document.activeElement))trigger(menu)?.focus({preventScroll:true});});
  }else if(!menu)closeAll();
 },true);
 root.addEventListener('keydown',event=>{
  const menu=event.target.closest?.(selector);if(!menu)return;
  const onTrigger=event.target===trigger(menu),key=event.key,list=items(menu),current=list.indexOf(document.activeElement);
  if(key==='Escape'&&menu.open){event.preventDefault();event.stopImmediatePropagation();close(menu,true);return;}
  if(key==='Tab'){close(menu,true);return;}
  if(onTrigger&&(key==='Enter'||key===' ')){event.preventDefault();event.stopImmediatePropagation();menu.open?close(menu):open(menu,'first');return;}
  if(menu.open&&!onTrigger&&(key==='Enter'||key===' ')){event.stopImmediatePropagation();return;}
  if(key==='ArrowDown'||key==='ArrowUp'){
   event.preventDefault();event.stopImmediatePropagation();if(onTrigger||!menu.open){open(menu,key==='ArrowUp'?'last':'first');return;}
   const next=(current+(key==='ArrowDown'?1:-1)+list.length)%list.length;list[next]?.focus({preventScroll:true});return;
  }
  if((key==='Home'||key==='End')&&menu.open&&!onTrigger){event.preventDefault();event.stopImmediatePropagation();(key==='Home'?list[0]:list.at(-1))?.focus({preventScroll:true});return;}
  if(key==='ArrowLeft'||key==='ArrowRight'){
   event.preventDefault();event.stopImmediatePropagation();const all=menus(),next=all[(all.indexOf(menu)+(key==='ArrowRight'?1:-1)+all.length)%all.length],wasOpen=menu.open;close(menu);trigger(next)?.focus({preventScroll:true});if(wasOpen)open(next,onTrigger?undefined:'first');return;
  }
  if(menu.open&&!onTrigger&&key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   const ordered=list.slice(current+1).concat(list.slice(0,current+1)),next=ordered.find(node=>node.textContent.trim().toLocaleLowerCase().startsWith(key.toLocaleLowerCase()));if(next){event.preventDefault();next.focus({preventScroll:true});}
  }
 },true);
 function init(){
  if(ready)return;ready=true;
  for(const menu of menus()){
   decorate(menu);setExpanded(menu);menu.addEventListener('toggle',()=>{setExpanded(menu);if(menu.open){closeAll(menu);place(menu);}});
   new MutationObserver(()=>{decorate(menu);if(menu.open)queue();}).observe(popup(menu),{childList:true,subtree:true});
  }
  const toolbar=document.querySelector('.compact-toolbar');if(toolbar&&root.ResizeObserver)new ResizeObserver(()=>{queue();root.portal?.map?.resize();}).observe(toolbar);
  root.addEventListener('resize',queue);root.visualViewport?.addEventListener('resize',queue);root.visualViewport?.addEventListener('scroll',queue);
  document.addEventListener('portal-language-changed',()=>{closeAll();queue();});
  document.addEventListener('portal-interface-changed',queue);update();
 }
 root.PortalToolbar={closeAll:()=>closeAll(),refresh:queue};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
