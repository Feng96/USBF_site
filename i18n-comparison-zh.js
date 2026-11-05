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
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
