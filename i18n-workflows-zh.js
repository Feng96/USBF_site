/* Translate interface instructions only; field names and record values remain opaque. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Reading full geometries exceeds the 32 MB browser budget. Use the local engine for this study area.|读取完整几何超出浏览器 32 MB 的容量限制，请使用本地引擎加载此研究区域。
This pinned release needs a full checksum-verified shard read. Use the local engine for this area.|固定版本需要完整读取分块并校验内容，请使用本地引擎加载此区域。
The original geometry row-group index is invalid.|原始几何的 Row group 索引无效。
The geometry row-group index does not cover the original file.|几何 Row group 索引没有覆盖完整原始文件。
The geometry row-group index is incomplete.|几何 Row group 索引不完整。
The original file row count no longer matches its source manifest.|原始文件记录数与来源清单不一致。
Start a task|开始任务
records|条记录
Count building records|统计建筑记录
Count whole records in a fixed workset or selection.|统计固定分析数据集或选择集中的完整记录。
Summarize building heights|汇总建筑高度
Report valid heights and missing values without filling gaps.|汇总有效高度和缺失值，保留原始缺失状态。
Find an area around buildings|创建建筑周边范围
Create a measured buffer around full selected geometries.|使用所选建筑的完整几何创建指定距离的 Buffer。
Create a shareable map|创建可分享地图
Style your layers and review coverage before sharing.|设置图层样式，并在分享前检查覆盖情况。
Choose and save an area|选择并保存区域
Choose study area|选择研究区域
Load a fixed workset|加载固定分析数据集
Load or choose workset|加载或选择分析数据集
Review exactly which records to use|确认具体使用哪些记录
Records to use|使用的记录
Use available height field|使用已有高度字段
Height summaries use positive finite values only; zero, negative sentinels and missing values are counted as unavailable. Original attributes remain unchanged.|高度汇总仅使用大于零的有限值；零、负数占位值和缺失值计为不可用，原始属性保持不变。
Height field|高度字段
Review buffer parameters|检查 Buffer 参数
Open map designer|打开地图设计器
Calculate summary|计算汇总
Calculating full input summary…|正在汇总完整输入数据…
Input records|输入记录数
Valid values|有效值
Missing values|缺失值
Minimum|最小值
Maximum|最大值
Mean|平均值
No height field available|没有可用的高度字段
Counts describe input records, not certified coverage of every real-world building.|数量表示输入记录数；不代表已确认包含现实中的所有建筑。
Summary complete. Missing values remain missing.|汇总完成，缺失值保持缺失。
The input changed. Calculate the summary again.|输入已发生变化，请重新计算汇总。
Update and pair the local engine to summarize full results.|请更新并配对本地引擎，以汇总完整结果。
The map runs in your browser. Original data downloads from public providers; these calculations run on this computer. Cloud computation is not connected.|地图在浏览器中显示，原始数据从公共来源下载；这些计算在本机执行。尚未连接云端计算。
Loading request|加载请求
Candidate index|候选分块索引
Provider coverage|来源覆盖情况
Partial request|请求尚未完整
Request complete|请求已完成
Request completion unknown|请求完成情况未知
All input records scanned|已扫描全部输入记录
Geometry index verified|几何范围索引已验证
Geometry index completeness unknown|几何范围索引完整性未知
Provider completeness verified|来源完整性已验证
Real-world completeness unknown|现实建筑覆盖完整性未知
Complete local result; map tiles follow the view, analysis uses full records|完整结果保存在本地；地图按视野读取瓦片，分析使用完整记录
Keep this data version|保留当前数据版本
A saved version verifies its original checksums. Remote source files may become unavailable; package local results to keep a portable copy.|保存的版本会校验原始内容。远程来源文件可能无法长期获取；打包本地结果可保留便携副本。
Project dependencies|Project 数据依赖
Package full native results or verify and relink a missing file when moving to another computer.|更换电脑时，可打包完整本地结果，或校验并重新关联缺失文件。
Project packages include complete local results, original attributes and embedded map assets. Public datasets, basemaps and the online renderer remain separate internet dependencies.|Project 数据包包含完整本地结果、原始属性和嵌入的地图资源。公共数据集、底图和在线显示程序仍需另行联网访问。
Files stay on your computer. Nothing is uploaded.|文件保留在本机，不会上传。
Package Project with full results|打包 Project 与完整结果
Download package|下载数据包
Restore on this computer|在本机恢复
Copy a .usbf.zip package into the local Files folder. Its SHA256 values are verified before any dependency is restored.|请将 .usbf.zip 数据包复制到本地 Files 文件夹；恢复依赖前会校验 SHA256。
Package folder|数据包文件夹
Browse packages|浏览数据包
Package path|数据包路径
Verify and restore package|校验并恢复数据包
Current map dependencies|当前地图的数据依赖
Matching file in this workspace|此工作区中的匹配文件
Verify and relink|校验并重新关联
Dependency available and verified|依赖可用且校验通过
Dependency unavailable|依赖不可用
No native dependencies in this map.|当前地图没有本地引擎数据依赖。
Update and pair the local engine to use Project packages.|请更新并配对本地引擎，以使用 Project 数据包。
Packaging complete native results…|正在打包完整本地结果…
Project package saved in Results/Packages.|Project 数据包已保存到 Results/Packages。
Copy the package into Files, then choose its relative path.|请将数据包复制到 Files，再选择其相对路径。
Verifying package checksums…|正在校验数据包…
Restoring full dependencies…|正在恢复完整数据依赖…
Verified dependencies remain in Files and Results. Your current map was kept.|已校验的依赖保留在 Files 和 Results 中，当前地图保持不变。
Dependency verified and relinked. Save the Project to keep this location.|依赖已校验并重新关联，请保存 Project 以记录此位置。
This older dependency has no saved SHA256. Reopen its original workspace and save the Project again.|旧版依赖没有保存 SHA256。请打开原始工作区并重新保存 Project。
The layer changed while relinking. The restored file remains in Results.|关联期间图层已变化，恢复的文件保留在 Results 中。
The relinked record count does not match this Project.|重新关联的记录数与此 Project 不一致。
Restored dependency record count does not match the package.|恢复后的记录数与数据包不一致。
Dependency restoration did not complete. Review it in Task center.|依赖恢复未完成，请在任务中心查看。
Folder listing is limited to 500 entries. Open a subfolder.|文件夹最多显示 500 项，请打开子文件夹。
Stop waiting|停止等待
Cancelled. Imported files and task history are kept.|已停止等待，导入文件和任务记录保留。
Use a saved boundary layer as a mask; native previews are display-only.|请使用已保存边界图层作为 Mask；本地结果预览仅供显示。
What would you like to achieve? Choose a goal and follow the steps. You can pause the guide while using any tool.|你想完成什么？选择一个目标，按步骤操作。使用其他工具时，可以暂时收起引导。
Change goal|更换目标
Completed steps|已完成的步骤
Workflow steps|任务步骤
Guide navigation|引导导航
Continue task|继续任务
Continue|继续
Step|步骤
Step complete|此步骤已完成
Not complete yet|此步骤尚未完成
Choose your map area|选择地图展示区域
Choose your study area|选择研究区域
Choose map layers|选择地图图层
Prepare building data|准备建筑数据
Design and export|设计并导出
Choose records and run|选择记录并执行
Review your map|检查地图
Review your result|检查结果
Save and finish|保存并完成
Move the map to the place you want to show, then use the current view. You can also save a boundary in Data & scope.|将地图移到想展示的地点，然后使用当前视图。也可以在“数据与范围”中保存边界。
A map frame describes what your audience sees. It does not select buildings for analysis.|地图画面决定读者能看到的区域，不会选取用于分析的建筑。
Save a boundary when loading original data from an online source. If you already imported a fixed dataset, you can use that dataset directly.|从在线来源加载原始数据时，请先保存边界。如果已经导入固定数据集，可以直接使用。
A saved boundary stays fixed when you pan or zoom the map.|拖动或缩放地图时，已保存的边界保持不变。
Add the layers you want to show. PMTiles, raster basemaps and original vector layers can all appear on a map.|添加想展示的图层。PMTiles、栅格底图和原始矢量图层都可以用于地图展示。
Fast display data is enough for map design. Loading analytical records is optional.|用于快速展示的数据就能用于地图设计，无需先加载分析记录。
Load original records for your saved area, import a vector file, or choose an existing analysis workset below.|为已保存的区域加载原始记录、导入矢量文件，或在下方选择已有的固定分析数据集。
PMTiles provides fast display. Analysis needs original records such as GeoJSON or a complete local GeoParquet result.|PMTiles 用于快速展示。分析需要原始记录，例如 GeoJSON 或完整的本地 GeoParquet 结果。
Open the map designer, set a title and legend, preview your layout, then export PNG or PDF. Return here after exporting.|打开地图设计器，设置标题和图例，预览版式，然后导出 PNG 或 PDF。导出后返回此处。
An exported map is an image or document. A Project keeps an editable map.|导出的地图是图片或文档。Project 用于保留可继续编辑的地图。
Choose exactly which records to use. Open Buffer, set a distance and units, then run the operation. Return after the result is created.|明确选择要使用的记录。打开 Buffer，设置距离和单位，然后执行。生成结果后返回此处。
Choose the input records and a height field, then calculate. Read the valid and missing value counts together.|选择输入记录和高度字段，然后计算。请同时查看有效值数量和缺失值数量。
Choose the input records, then calculate their count. All records means this fixed dataset, not every building in the country.|选择输入记录，然后计算数量。“全部记录”指这个固定数据集中的记录，并不表示全国所有建筑。
Moving the map never changes this analytical input. Selected records refers to the batch selection, not the single highlighted building.|移动地图不会改变这里的分析输入。“选中记录”指批量选择集，不是当前单个高亮建筑。
Check the exported map title, legend, visible layers, source attribution and coverage. Confirm after reviewing the output.|检查导出地图的标题、图例、可见图层、来源署名和覆盖情况。查看输出后再确认。
A clear legend and source notes help readers understand what the map represents.|清楚的图例和来源说明能帮助读者理解地图表达的内容。
Choose the completed Buffer task you just ran. Inspect its output and distance settings in Task center, then confirm your review.|选择刚才执行完成的 Buffer 任务。在任务中心查看输出和距离设置，然后确认检查完成。
Read the result and coverage notes. Open the attribute table to inspect the original records if needed, then confirm your review.|阅读结果和覆盖说明。如有需要，打开属性表检查原始记录，然后确认检查完成。
Request completion does not establish complete coverage of real-world buildings. Partial results must be described as partial.|请求完成不代表已经包含现实中的所有建筑。结果不完整时，必须明确说明。
Save your editable map as a Project. You can also finish without saving, or download a Project file to move it to another computer.|将可编辑地图保存为 Project。也可以直接完成，或下载 Project 文件以便在另一台电脑上打开。
A Project saves map settings and input layers. Summary values in this guide stay in this session; download the summary separately.|Project 保存地图设置和输入图层。引导中的统计结果仅保留在当前会话中，请单独下载统计结果。
Open area settings|打开区域设置
Use current map view|使用当前地图视图
Use existing dataset|使用已有数据集
Add map layers|添加地图图层
Import a local file|导入本地文件
Choose an analysis workset|选择固定分析数据集
Use current map layers|使用当前地图图层
Basemap only|仅显示底图
Export a map from the designer before continuing.|请先在地图设计器中导出地图，再继续。
Opening Buffer or creating a plan does not create a result. Run the task, then choose its completed result.|打开 Buffer 或创建计划并不会生成结果。请执行任务，然后选择已完成的结果。
Calculate the result before continuing.|请先计算结果，再继续。
Choose the completed Buffer result|选择已完成的 Buffer 结果
This Buffer task used a different input. Choose the task for this workset and record scope.|此 Buffer 任务使用了不同的输入。请选择与当前固定数据集和记录范围相符的任务。
Buffer result|Buffer 结果
Open Task center|打开任务中心
Inspect input records|检查输入记录
Download summary|下载统计结果
I have reviewed the result and coverage notes|我已检查结果和覆盖说明
Save Project|保存 Project
Open Projects|打开 Project 管理
Download Project file|下载 Project 文件
Finish task|完成任务
Finish without saving|直接完成，不保存
Project saved in this browser.|Project 已保存在此浏览器中。
This workflow has not saved a Project yet.|此任务流程尚未保存 Project。
Workflow complete|任务流程已完成
You can return to your tools or choose another goal. Your map and data remain available.|你可以返回工具继续操作，或选择另一个目标。当前地图和数据仍可继续使用。
Guide progress stays in this tab until you switch Projects or reload. Closing this guide keeps your current step.|引导进度保留在当前标签页中，切换 Project 或重新加载页面后会重置。关闭引导会保留当前步骤。
Project file downloaded. Summary values are a separate download.|Project 文件已下载。统计结果需要单独下载。
Summary downloaded. Keep it with your Project.|统计结果已下载，请与 Project 一起保存。
The input changed. Repeat the result step before finishing.|输入已发生变化，请重新生成结果后再完成任务。
Map exported|地图已导出
Map exported. Return to the guide to review it.|地图已导出，请返回引导检查结果。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
