/* UI instructions only. Dataset names, fields and original values remain opaque. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Close panel|关闭面板
This operation uses|本次操作使用
Not counted yet|尚未计数
Counting input records…|正在计算输入记录数…
Choose an analysis workset.|请选择分析数据集。
This layer is for display. Load original records before analysis.|此图层用于展示，请先加载原始记录再分析。
Select records or choose all records.|请选择记录，或改为使用全部记录。
Coverage unknown|覆盖情况未知
Original records for analysis|用于分析的原始记录
Display only|仅用于展示
Data format|数据格式
Data purpose|数据用途
Coverage|覆盖情况
Loading area|数据加载范围
Processing area|本次处理范围
Input records across layers|各输入图层的记录总数
Counts are summed across inputs; the same building can occur in more than one source.|此处数量为各输入记录数之和；同一栋建筑可能存在于多个来源中。
The active map layer is different from this tool input.|当前地图活动图层与此工具的输入不同。
Viewing, selection and table filters|查看、选择与表格过滤
Map focus|地图焦点
Map focus is on another layer.|地图焦点位于另一个图层。
The table displays another layer.|属性表当前显示另一个图层。
Batch selection|批量选择集
Table records shown|表格显示记录数
Table closed|属性表已关闭
paged|分页显示
matching records|匹配记录
Map focus, batch selection and table search are separate. Only the explicit record scope above defines this operation.|地图焦点、批量选择和表格搜索是不同状态。本次操作仅使用上方明确指定的记录范围。
The input changed. Check the operation scope again.|输入已经变化，请重新核对操作范围。
Analysis input|分析输入
Report input|报告输入
First comparison input|比较的第一份输入
Choose a data connection before loading records.|请先选择数据连接，再加载记录。
Choose data source|选择数据来源
Save a study area before loading original records.|请先保存研究区域，再加载原始记录。
Define study area|定义研究区域
This connection has no original-data loader. Choose another source or import an original file.|此连接没有原始数据加载接口。请选择其他来源，或导入原始文件。
Choose original data|选择原始数据
Connect the local engine before preparing this loading task.|请先连接本地引擎，再准备此加载任务。
Connect local engine|连接本地引擎
Connect the local engine before preparing this processing task.|请先连接本地引擎，再准备此处理任务。
Advanced loading limits and coverage|高级加载限制与覆盖说明
Choose all, selected or saved-area records.|请选择全部记录、选中记录或研究区域内记录。
`.trim().split('\n')){const i=row.indexOf('|');d[row.slice(0,i)]=row.slice(i+1);}})();
