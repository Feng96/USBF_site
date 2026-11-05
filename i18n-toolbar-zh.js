/* Workspace labels only. Source records and field names are never translated. */
Object.assign(window.PortalTranslations['zh-CN'],Object.fromEntries([
 'Quick actions|快捷操作',
 'Workspace menus|工作区菜单',
 'Data|数据',
 'Map|地图',
 'Select|选择',
 'Analysis|分析',
 'Layer|图层',
 'Project|项目',
 'Explore the map|浏览地图',
 'Selected records|已选记录',
 'Workspace|工作区',
 'Common panels|常用面板',
 'Customize interface|自定义界面'
].map(row=>{const i=row.indexOf('|');return [row.slice(0,i),row.slice(i+1)];})));
