/* Portable project validation messages; basemap names and data stay unchanged. */
Object.assign(window.PortalTranslations['zh-CN'],Object.fromEntries(`
The saved interface layout is invalid.|保存的界面布局无效。
The saved custom basemap is invalid.|保存的自定义底图无效。
The saved basemap tile connection is invalid.|保存的底图瓦片连接无效。
The saved basemap image has invalid bounds or no original file.|保存的底图图片范围无效，或缺少原始文件。
A custom basemap must be selected to store its connection.|只有选择自定义底图时，才能保存其连接。
The basemap tools are still loading.|底图工具仍在加载。
The original basemap image is unavailable.|原始底图图片不可用。
`.trim().split('\n').map(row=>{const i=row.indexOf('|');return[row.slice(0,i),row.slice(i+1)];})));
