/* Interface text only; dataset names and original records stay unchanged. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Visualization layers|可视化图层
Tiles, live previews and reference imagery. Analysis requires original records.|瓦片、实时预览和参考影像。分析需要使用原始记录。
No visualization layers|尚无可视化图层
Browse data catalog|浏览数据目录
Original records, analysis results and study boundaries. These can also appear on the map.|原始记录、分析结果和研究范围边界，也可以显示在地图上。
No analysis data|尚无分析数据
Prepare analysis data|准备分析数据
Both sections can appear on the map. Map order 1 draws on top.|两个区的数据都可以显示在地图上。地图顺序为 1 的图层绘制在最上方。
Map order|地图顺序
No matching layers in this section.|此区没有匹配的图层。
`.trim().split('\n')){const at=row.indexOf('|');d[row.slice(0,at)]=row.slice(at+1);}})();
