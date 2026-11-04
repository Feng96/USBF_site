/* Map authoring interface. Map titles, names, fields and source values remain opaque. */
Object.assign(window.PortalTranslations['zh-CN'],Object.fromEntries(`
MAP DESIGN|地图设计
Minimize map designer|最小化地图设计器
Map design view|地图设计视图
Design|设计
Rendered preview|渲染预览
Pan, zoom and style the map beside this editor. Your current view becomes the map frame.|可直接平移、缩放旁边的地图并调整图层样式，当前视图即为出图范围。
Live layout guide|实时版式参考
Draft · not the final export|草稿 · 非最终导出效果
Live copy of the current map|当前地图的实时缩略图
Live thumbnail unavailable. The map remains interactive.|暂时无法显示实时缩略图，仍可直接操作地图。
Complete source credits are retained in the export.|导出文件保留完整来源署名。
Generate a rendered preview to check exact output. The live guide does not download data.|生成渲染预览可检查最终出图效果，实时参考不会下载分析数据。
Generate a preview to check the final rendered map.|请生成预览以检查最终地图效果。
Preview is out of date. Update it to include your latest changes.|预览已过期，请更新以包含最新修改。
Preview matches the captured view and layout.|预览对应已捕获的视图和版式。
No rendered preview yet. Generate one after adjusting the map and layout.|尚无渲染预览，请调整地图和版式后生成。
Update preview|更新预览
Back to design|返回设计
Generate preview|生成预览
Resume map design|继续地图设计
Dismiss map design shortcut|关闭地图设计快捷入口
Rendered map preview|地图渲染预览
`.trim().split('\n').map(row=>{const i=row.indexOf('|');return[row.slice(0,i),row.slice(i+1)];})));
