/* Boundary editing instructions only; names and source attributes stay raw. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Choose a fixed original polygon layer with up to 100 polygons.|请选择包含不超过 100 个多边形的固定原始数据图层。
Original source|原始来源
Current study area selected.|已设为当前研究范围。
Study area created from original polygons.|已从原始多边形创建研究范围。
Edit saved study area|编辑已保存的研究范围
Update study area|更新研究范围
Cancel boundary edit|取消编辑边界
Updating this boundary does not reload or change existing analysis records.|更新此边界不会重新加载或更改已有分析记录。
Choose a saved study area.|请选择已保存的研究范围。
Edit the boundary, then update this study area. Loaded worksets keep their original loading boundary.|修改边界后更新此研究范围。已加载数据集保留原来的加载范围。
The study area changed. Reopen its editor before updating it.|研究范围已发生变化，请重新打开编辑器再更新。
Study area updated. Existing worksets retain their loading boundary; saved-area operations use the updated boundary.|研究范围已更新。已有数据集保留原加载范围；按研究范围执行的操作使用更新后的边界。
Boundary edit cancelled. The saved study area is unchanged.|已取消编辑，保存的研究范围保持原样。
`.trim().split('\n')){const at=row.indexOf('|');d[row.slice(0,at)]=row.slice(at+1);}})();
