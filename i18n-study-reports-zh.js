/* Report interface only. Source fields, values and generated data columns stay raw. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Check building data quality|检查建筑数据质量
Compare building statistics by zone|按分区比较建筑统计
Choose building records as the input, and a boundary layer for zones.|请选择建筑记录作为输入，并选择边界图层作为分区。
Update and pair the local engine to report on complete result records.|请更新并配对本地引擎，以对完整结果生成报告。
Choose original building polygons instead of a Buffer output.|请选择原始建筑多边形，而不是 Buffer 输出。
The report input changed. Run the report again.|报告输入已变化，请重新运行报告。
Enter a positive height review threshold.|请输入大于零的高度检查阈值。
This report exceeds 20,000 browser records. Choose a smaller saved area or use the local engine.|本报告超出浏览器 20,000 条记录的限制。请选择更小的已保存区域或使用本地引擎。
This report exceeds the browser geometry budget. Choose fewer records or use the local engine.|本报告超出浏览器几何容量限制。请选择更少的记录或使用本地引擎。
A complete native result query is required.|需要查询完整的本地结果。
Duplicate identifiers and exact duplicate geometries are not checked by this native report.|本地报告尚未检查重复标识符和几何完全重复的记录。
A review threshold flags values for inspection and does not certify errors.|超过阈值的值仅被标记为待检查，不表示已确认错误。
Request completion does not establish real-world building completeness.|请求完成不代表已包含现实中的所有建筑。
Geometry validation stops above 2,000 vertices per record or 20 million vertex-pair checks per report. Remaining records are not checked.|每条记录超过 2,000 个顶点，或整份报告达到 2,000 万次顶点对检查后，不再运行几何有效性检查。其余记录标记为尚未检查。
The native height mean is not checked because the original column is not numeric.|原始字段并非数值列，因此本地报告未计算平均高度。
Choose a complete polygon boundary layer for zones.|请选择完整的多边形边界图层作为分区。
Choose at most 100 zone polygons per report.|每份报告最多选择 100 个分区多边形。
The zone boundaries exceed the browser geometry budget.|分区边界超出浏览器几何容量限制。
This zonal report exceeds 500,000 browser record-zone pairs. Choose fewer zones or use the local engine.|本分区报告超出浏览器 500,000 组记录与分区比较的限制。请选择更少的分区或使用本地引擎。
The zonal spatial complexity exceeds the browser budget. Choose fewer records or use the local engine.|分区空间计算的复杂度超出浏览器容量限制。请选择更少的记录或使用本地引擎。
A zone has no measurable area.|某个分区没有可测量的面积。
Zonal building reports require original polygon records.|建筑分区报告需要原始多边形记录。
One building exceeds the zonal geometry budget. Use the local engine.|某个建筑超出分区分析的单个几何容量限制，请使用本地引擎。
An input polygon is invalid. Inspect the quality report before zonal analysis.|某个输入多边形无效，请先查看质量报告，再进行分区分析。
The zonal measurements exceed the supported numeric range.|分区测量值超出支持的数值范围。
Not checked|尚未检查
Geometry records checked|已检查几何的记录数
Invalid geometry records|无效几何记录数
Geometry records not checked|尚未检查几何的记录数
Non-polygon records|非多边形记录数
Valid height records|有效高度记录数
Missing height records|不可用高度记录数
Mean height|平均高度
Above review threshold|超过检查阈值的记录数
Duplicate identifier records|标识符重复的记录数
Exact geometry duplicate records|几何完全重复的记录数
Each intersecting building is counted in every matching zone. Zone totals may include the same building more than once.|每个建筑计入与其相交的所有分区。不同分区的记录数可能重复包含同一建筑。
Zone|分区
Building records|建筑记录数
Zone area · km²|分区面积 · km²
Buildings / km²|建筑记录数 / km²
Choose a boundary layer|选择边界图层
Reports use fixed original records. The current map view and display previews are never analytical input.|报告使用固定的原始记录。当前地图视图和显示预览不会作为分析输入。
Zone boundary layer|分区边界图层
Original identifier field|原始标识符字段
Use original identifier field|使用原始标识符字段
Height review threshold · source units|高度检查阈值 · 原始单位
Heights use positive finite supplied values. Original units and missing values are preserved.|高度统计仅使用原始属性中大于零的有限值。保留原始单位和缺失值。
Run report|生成报告
Download JSON report|下载 JSON 报告
Download CSV report|下载 CSV 报告
Open result attribute table|打开结果属性表
Calculating report…|正在生成报告…
Report complete. Review coverage and download the report.|报告已生成，请检查覆盖情况并下载报告。
Wait for the current report or cancel it first.|请等待当前报告完成，或先取消当前报告。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
