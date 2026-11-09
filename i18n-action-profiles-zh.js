/* Role-specific interface language; original records and names remain raw. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Visualization tools|可视化工具
Analysis tools|分析工具
Analysis tools · local file|分析工具 · 本地文件
Study area tools|研究范围工具
Layer tools|图层工具
Map display|地图显示
Layer management|图层管理
Choose a layer to see its available operations.|请选择图层以查看适用操作。
These tools change the display. Analysis needs a fixed set of original records.|这些工具调整地图显示。分析需要明确范围内的固定原始记录。
This boundary defines where data is loaded or processed; it is not a building workset.|此边界用于确定加载或处理范围，不是建筑分析数据集。
Connect the workspace containing the full result. Display previews are not analytical inputs.|请连接存有完整结果的工作区。显示预览不能作为分析输入。
Operations use original records and the explicit all, selection or study-area scope.|操作使用原始记录，并以明确选择的全部记录、已选记录或研究范围为准。
Tile attribute preview|瓦片属性预览
Preview attributes|预览属性
Boundary attribute table|边界属性表
Prepare analysis data|准备分析数据
Download records|下载记录
Download boundary|下载边界
Copy result reference|复制结果引用
Copy boundary|复制边界
Copy records to new layer|复制记录到新图层
Copy preview layer|复制预览图层
Copy display connection|复制显示连接
Create full-result extent|创建完整结果范围
Create data extent|创建数据范围
Create boundary extent|创建边界范围
Create display extent|创建显示范围
Display filters|显示过滤
Use as study area|设为研究范围
Edit study area|编辑研究范围
Connect local engine|连接本地引擎
Verify local dependencies|检查本地依赖
This layer has no map display filters.|此图层没有地图显示过滤选项。
The display controls are still loading.|显示控制工具仍在加载。
Original records are already available in this layer.|此图层已提供原始记录。
Choose a complete original polygon layer for a study area.|请选择包含完整原始几何的多边形图层作为研究范围。
Choose a saved study area to edit.|请选择已保存的研究范围进行编辑。
The study area editor is still loading.|研究范围编辑器仍在加载。
This layer does not depend on a local result file.|此图层不依赖本地结果文件。
Device settings are still loading.|设备设置仍在加载。
Project dependency tools are still loading.|Project 依赖工具仍在加载。
A study boundary is not an analysis workset. Open its original boundary records.|研究边界不是分析数据集，请查看其原始边界记录。
A study boundary is not an analysis workset. Download its original boundary records.|研究边界不是分析数据集，请下载其原始边界记录。
Preview attributes are display records. Prepare original analysis data before choosing an analytical scope.|预览属性属于显示记录，请先准备原始分析数据再选择分析范围。
`.trim().split('\n')){const at=row.indexOf('|');d[row.slice(0,at)]=row.slice(at+1);}})();
