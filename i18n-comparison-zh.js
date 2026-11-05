/* System interface text only; original source names, fields and values stay opaque. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Compare building sources|比较建筑数据来源
Compare sources|比较来源
Compare two original polygon worksets with one saved study area and an explicit record scope.|使用同一个已保存研究区域和明确的记录范围，比较两个原始面数据集。
Load at least two original building worksets in Data workspace. Display tiles cannot be compared as original data.|请在数据工作区加载至少两个原始建筑分析数据集。显示瓦片不能作为原始数据进行比较。
First workset|第一个分析数据集
Second workset|第二个分析数据集
Choose an original workset|选择原始分析数据集
Area scope keeps whole intersecting outlines. All and selected modes require both worksets to have the same saved loading area.|区域范围保留完整相交轮廓。使用全部或已选记录时，两个数据集必须具有相同的已保存加载区域。
Download comparison receipt|下载比较记录
Open Data workspace|打开数据工作区
Total footprint area (m²)|轮廓总面积（m²）
Polygons included in area|计入面积的面记录数
Invalid or empty geometries|无效或空几何数
Original height field|原始高度字段
Records with supplied height|具有来源高度的记录
Height unavailable|高度不可用
Area measurement|面积测量方法
Spherical Earth (Turf), square metres|球面地球（Turf），平方米
WGS84 ellipsoid (DuckDB ST_Area_Spheroid), square metres|WGS84 椭球（DuckDB ST_Area_Spheroid），平方米
Complete native result|完整本地结果
Fixed browser workset|固定浏览器分析数据集
Difference (second minus first)|差值（第二个减去第一个）
Area differences are approximate because measurement methods differ.|由于测量方法不同，面积差值为近似值。
Sum of valid whole polygon areas; overlapping records count separately.|对有效完整面记录的面积求和；重叠记录分别计入。
Heights use positive finite supplied values. Source heights may be estimates; rendering defaults and building levels are excluded.|高度仅统计来源提供的大于零的有限值。来源高度本身可能为估计值；显示默认值和建筑层数不计入。
Aggregate comparison does not establish one-to-one footprint matches or accuracy.|汇总比较不能确定轮廓的一对一匹配关系或准确性。
Sources may share upstream buildings or heights. Agreement is not independent validation; provider completeness remains unknown.|不同来源可能共用上游建筑轮廓或高度。结果一致不构成独立验证，来源完整性仍未知。
Inputs changed. Run the comparison again.|输入已变化，请重新运行比较。
Comparing complete input records…|正在比较完整输入记录…
Comparison complete. Review coverage and provenance.|比较已完成，请检查覆盖情况和来源。
Comparison cancelled.|比较已取消。
Choose two different original polygon worksets.|请选择两个不同的原始面分析数据集。
Choose original polygon worksets for source comparison.|请选择原始面分析数据集进行来源比较。
Update and pair the local engine to compare complete result records.|请更新并配对本地引擎，以比较完整结果记录。
The saved study area changed. Run the comparison again.|已保存研究区域已变化，请重新运行比较。
A comparison input changed. Run the comparison again.|比较输入已变化，请重新运行比较。
All or selected records require worksets loaded for this same saved area. Choose saved-area records to apply one explicit boundary.|全部或已选记录要求两个数据集均按同一个已保存区域加载。选择已保存区域内的记录可应用同一个明确边界。
This comparison input exceeds 20,000 records. Use a smaller saved area or the local engine.|此比较输入超过 20,000 条记录。请使用更小的已保存区域或本地引擎。
This comparison input exceeds the browser vertex budget. Use the local engine.|此比较输入超出浏览器顶点数量限制，请使用本地引擎。
One polygon exceeds the browser geometry budget. Use the local engine.|单个面超出浏览器几何容量限制，请使用本地引擎。
Source comparison requires a complete native result query.|来源比较需要查询完整本地结果。
Choose all, selected or saved-area records.|请选择全部记录、已选记录或已保存区域内记录。
Optional building correspondence|可选建筑对应分析
Match complete original buildings with the local engine|使用本地引擎匹配完整原始建筑记录
Building matches|建筑匹配
Summary|汇总
IoU threshold|交并比阈值
Either-side coverage threshold|任一侧覆盖率阈值
Compatible source IDs take priority. Other candidates require positive exact overlap and either threshold. Splits, merges and ambiguities stay visible.|优先采用兼容的来源标识。其他候选必须存在实际面积重叠，并满足交并比或任一侧覆盖率阈值。保留拆分、合并和歧义关系。
Building correspondence requires an updated paired local engine. Summary comparison also works in the browser.|建筑对应分析需要更新并配对本地引擎。汇总比较也可直接在浏览器中使用。
Connect and pair the local engine to match complete original buildings.|请连接并配对本地引擎，以匹配完整原始建筑记录。
Update and pair the local engine to match complete original buildings.|请更新并配对本地引擎，以匹配完整原始建筑记录。
This browser workset exceeds the 15 MiB staging budget. Import its original file in the local engine.|此浏览器分析数据集超出 15 MiB 暂存限制。请在本地引擎中导入原始文件。
Saving complete original records in the local engine…|正在向本地引擎保存完整原始记录…
Matching complete original buildings…|正在匹配完整原始建筑…
Enable building correspondence and compare sources to create a full native pair report.|启用建筑对应分析并比较来源，以生成完整本地对应报告。
One to one|一对一
One to many / possible split|一对多／可能拆分
Many to one / possible merge|多对一／可能合并
Ambiguous correspondence|对应关系有歧义
First source only|仅第一个来源
Second source only|仅第二个来源
Invalid first-source outline|第一个来源的无效轮廓
Invalid second-source outline|第二个来源的无效轮廓
Correspondence candidates retain splits, merges and ambiguities. Agreement is not independent validation or an accuracy score.|候选对应关系保留拆分、合并和歧义。结果一致不构成独立验证，也不代表准确率。
Matched original records|具有对应关系的原始记录
All report rows|全部报告行
Download full pair report (CSV)|下载完整对应报告（CSV）
Download full pair report (JSON)|下载完整对应报告（JSON）
report rows|报告行
selected pairs|已选对应行
First source ID|第一个来源的标识
Second source ID|第二个来源的标识
Correspondence|对应关系
Coverage first / second|覆盖率：第一／第二
Select pair|选择对应行
Compatible source provenance|兼容的来源溯源标识
Exact spatial overlap|精确空间重叠
No accepted correspondence|没有符合条件的对应关系
Previous page|上一页
Next page|下一页
Clear selected pairs|清除所选对应行
Record actions use selected pairs, or every row in the current category when no pairs are selected. Original attributes are preserved.|记录操作使用已选对应行；未选择时使用当前类别中的全部行。保留原始属性。
Open original records table|打开原始记录表
Export original records (GeoJSON)|导出原始记录（GeoJSON）
Add discrepancy records to map|将差异记录添加至地图
Report task|报告任务
Exact polygon intersections in EPSG:6933 equal-area projection, square metres|在 EPSG:6933 等积投影中精确计算面交集，单位为平方米
Reading complete original records…|正在读取完整原始记录…
Complete original record action finished.|完整原始记录操作已完成。
This report category has no original records on this source side.|此报告类别在所选来源一侧没有原始记录。
Building correspondence report|建筑对应报告
Building correspondence records|建筑对应记录
Creating a complete discrepancy layer…|正在创建完整差异图层…
Building correspondence report loaded.|建筑对应报告已加载。
All or selected records require worksets loaded for this same saved area.|全部或已选记录要求数据集按同一个已保存区域加载。
Building correspondence exceeds the 2,000,000 candidate budget. Use a smaller saved study area or explicit selections.|建筑对应分析超出 2,000,000 条候选关系限制。请使用更小的已保存区域或明确的选择记录。
IoU and coverage thresholds must be greater than zero and at most one.|交并比与覆盖率阈值必须大于零且不超过一。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
