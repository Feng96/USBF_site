/* GIS interface only; raw field names, formats and place names stay unchanged. */
Object.assign(window.PortalTranslations['zh-CN'], Object.fromEntries(`
Focused map record|地图焦点记录
This record is outside the current table input or filters.|此记录不在当前表格范围或筛选结果中。
This record is outside the current table page or filters.|此记录不在当前表格页或筛选结果中。
Clear focus|清除焦点
Open feature table|打开此要素的属性表
Record focus does not change the batch selection.|单要素焦点不会改变批量选择。
Click a row to highlight it on the map. Use Locate to move the view.|点击记录可在地图上高亮，使用“定位”可移动视野。
Showing the first 80 fields.|仅显示前 80 个字段。
Locate|定位
Locate on map|定位
Locate this record on the map|在地图上定位此记录
This record has no usable map geometry.|此记录没有可用于地图定位的几何信息。
The map is not ready.|地图尚未就绪。
Update the local engine to locate complete result records.|请更新本地引擎，以定位完整结果中的记录。
This table record does not have a native row identity.|此表格记录缺少本地结果行标识。
Locating record on map…|正在地图上定位记录…
Reload this page to locate table records.|请刷新页面以定位表格记录。
Preview connections read original records in the current view unless a range is chosen.|未指定范围时，预览图层连接会读取当前地图视野内的原始记录。
Reopen the original PMTiles file to create an independent connection.|请重新打开原始 PMTiles 文件以创建独立连接。
Workspace options|工作区选项
GIS workspace tools|GIS 工作工具
DATA|数据
SELECTION|选择
PROCESSING|处理
LAYERS|图层
PROJECT & OUTPUT|项目与输出
Load range|加载范围
Navigate|地图浏览
Select features|选择要素
Selected|已选择
Click / multiple selection|点选／多选
Box selection|框选
Polygon selection|多边形选择
Select by location|按位置选择
Select by attribute|按属性选择
Select all loaded records|选择全部已加载记录
Invert selection|反选
Zoom to selection|缩放至所选记录
Export selected GeoJSON|导出所选记录 GeoJSON
Export selected CSV|导出所选记录 CSV
Selected records table|已选记录属性表
Add selected to new layer|将已选记录添加到新图层
Extract unselected records|提取未选记录
Geoprocessing|空间处理
Extract by box|按范围框提取（Extract by box）
Extract by mask|按掩膜提取（Extract by mask）
Clip outlines|裁切轮廓（Clip）
Erase by mask|按掩膜擦除（Erase）
Merge layers|合并图层（Merge）
Dissolve polygons|融合多边形（Dissolve）
Buffer|缓冲区（Buffer）
Multipart to singlepart|多部件转单部件
Remove exact duplicates|移除几何完全相同的记录
Overlay & area summaries|叠加与区域统计
Layer actions|图层操作
Duplicate layer|复制图层
Rename layer|重命名图层
Create layer extent|创建图层范围
Remove last GIS output|移除上一次 GIS 输出
Area source|范围来源
U.S. state|美国州
U.S. county|美国县／等同区域
Bounding box in working CRS|当前工作 CRS 下的范围框
Polygon boundary in working CRS|当前工作 CRS 下的多边形边界
Layer extent|图层范围
Polygon layer boundary|多边形图层边界
Last map box|上一次地图框选范围
Choose a state|选择州
County|县／等同区域
xmin, ymin, xmax, ymax|xmin, ymin, xmax, ymax
Use current view coordinates|填入当前视野坐标
Polygon GeoJSON or x,y pairs, one per line|多边形 GeoJSON 或 x,y 坐标（每行一组）
Open a boundary GeoJSON|打开边界 GeoJSON
Reference layer|参考图层
Loading administrative areas…|正在加载行政区列表…
Working CRS changed. Re-enter boundary coordinates.|工作 CRS 已改变，请重新输入边界坐标。
Replace selection|替换选择
Add to selection|添加到选择
Remove from selection|从选择中移除
Keep common selection|保留共同选择
Done selecting|结束选择
Drag a box to select whole buildings|拖动范围框以选择完整建筑
Click polygon corners, then Finish|点击多边形顶点，然后完成
Click a building; Ctrl/Cmd toggles selection|点击建筑；Ctrl/Cmd 切换其选择状态
Vector processing|矢量数据处理
Operation|操作
Input layer / layers|输入图层（可多选）
Input records|输入记录
Selected records only|仅已选记录
Records in a chosen range|所选范围内的记录
Operation boundary|操作边界
Buffer distance · metres|缓冲距离 · metres
Dissolve field|Dissolve 分组字段
All polygons|全部多边形
Output layer name|输出图层名称
Large original-data requests may be partial. Coverage and source lineage are saved with every output.|大范围原始数据可能仅部分载入。每个输出都会保留覆盖范围与来源记录。
Run and add layer|运行并添加图层
Merge appends records and keeps overlapping or duplicate buildings. It does not dissolve boundaries.|Merge 追加输入记录并保留重叠或重复建筑，不会融合边界。
Whole source features touching the boundary are kept. Outlines and original attributes remain intact.|保留与边界相交的完整原始要素，轮廓和原始属性保持完整。
This changes polygon outlines. Output is a derived layer; original height attributes are not automatically used for 3D.|此操作改变多边形轮廓。输出为派生图层，原始高度属性不会自动用于 3D。
Keep the first record with each exactly matching geometry. Attributes of later duplicates are not combined.|每种完全相同的几何只保留第一条记录，不合并后续重复记录的属性。
Results are added as a new layer. Source layers are kept.|结果添加为新图层，并保留源图层。
Comparison|比较条件
Contains text|包含文本
Is null|为 null
Field not provided|字段未提供
Is empty text|为空文本
Value|值
Selection mode|选择方式
Select records|选择记录
Load another range|加载其他范围
Load the chosen range as a separate GeoJSON layer. Source geometry, attributes, licenses and coverage limits are retained.|将所选范围加载为独立 GeoJSON 图层，保留原始几何、属性、许可和覆盖范围限制。
Output added with partial source coverage.|已添加输出图层，源数据覆盖范围不完整。
GIS output layer added.|已添加 GIS 输出图层。
`.trim().split('\n').map(row => { const i = row.indexOf('|'); return [row.slice(0, i), row.slice(i + 1)]; })));
