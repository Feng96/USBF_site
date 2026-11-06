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
Download buildings for an area|下载指定区域的建筑
Choose a boundary, load original records and download the exact input.|选择边界、加载原始记录，并下载明确范围内的数据。
Find buildings that match your needs|查找符合条件的建筑
Select records by attributes or on the map, then save the selection.|按属性或在地图上选择记录，再保存选择集。
Explore height and area distributions|查看建筑高度与面积分布
Create a chart from original fields and download its underlying values.|使用原始字段制作图表，并下载图表使用的数据。
Compare building data sources|比较建筑数据来源
Compare two original datasets for the same saved area.|在同一个已保存区域内比较两个原始数据集。
Check whether your data is suitable|检查数据是否适合使用
Review missing heights, geometry checks and coverage in a quality report.|通过质量报告检查高度缺失、几何和覆盖情况。
Summarize buildings by area|按区域汇总建筑
Count buildings and summarize supplied heights for each boundary.|为每个边界区域统计建筑数量和已有高度。
Combine building files|合并建筑文件
Merge original datasets, review fields and keep duplicates visible.|合并原始数据集、核对字段，并明确保留重复记录。
Hand a Project to a teammate|将 Project 交接给同事
Check dependencies and export a Project file or a complete local package.|检查数据依赖，并导出 Project 文件或完整的本地数据包。
All goals|全部目标
Get data|获取数据
Analyze buildings|分析建筑
Check & compare|检查与比较
Map & share|制图与分享
Data quality report|数据质量报告
Choose the Project|选择 Project
Check dependencies|检查数据依赖
Export a handoff|导出交接成果
Review the handoff|检查交接成果
Select and save records|选择并保存记录
Choose files and merge|选择文件并合并
Choose zones and summarize|选择分区并汇总
Choose the records you want to download. Open the normal Download data tool, choose a format, and save the file.|选择要下载的记录。打开常用的“下载数据”工具，选择格式，然后保存文件。
Open the attribute table to verify the original fields and record count. Keep the download together with its coverage notes.|打开属性表，核对原始字段和记录数。请将下载的数据与覆盖说明一起保存。
Open Select by attribute, Box selection or Polygon selection. These normal tools search the complete fixed workset. Save matching records to a new layer or download the selection.|打开“按属性选择”“框选”或“多边形选择”。这些常用工具使用完整的固定分析数据集。将符合条件的记录保存为新图层，或下载选择集。
Inspect the selected records and their original attributes. Single-feature focus and batch selection remain separate.|检查选中记录及其原始属性。单个要素高亮与批量选择集分别管理。
Open the normal Charts tool. Choose an original field and chart type, then generate the chart. Missing values remain missing.|打开常用的“图表”工具。选择原始字段和图表类型，然后生成图表。缺失值保持缺失。
Read the axis labels, units, input count and missing values. Download the chart image or underlying values from the same Charts tool.|检查坐标轴标签、单位、输入记录数和缺失值。使用同一个“图表”工具下载图片或图表数据。
Open Compare sources. Choose a second original workset and the same saved study area, then run the comparison.|打开“比较来源”。选择第二个原始分析数据集和同一个已保存研究区域，然后执行比较。
Review the actual input identities, record counts, source dates, measurement methods and coverage. Download the comparison receipt.|检查实际输入数据、记录数、来源日期、测量方法和覆盖情况。下载比较记录。
Open Merge layers, select at least two original inputs, review their fields and record scope, then run. Browser and local tasks use the normal processing tool.|打开“合并图层”，选择至少两个原始输入，核对字段和记录范围，然后执行。浏览器和本地任务使用同一个常用处理工具。
Choose the completed Merge task and inspect its result. Merge appends records; overlapping or duplicate buildings remain unless you explicitly run a separate check.|选择已完成的 Merge 任务并检查结果。Merge 会追加记录；重叠或重复建筑会保留，需要另行检查。
Open Data quality report. Choose the ID and height fields and run the available checks on the original records.|打开“数据质量报告”。选择 ID 和高度字段，并对原始记录执行可用检查。
Review each check and its method. Not checked is different from zero problems. Download the report and keep the source coverage notes.|逐项检查结果及其方法。“未检查”不表示没有问题。请下载报告，并保留来源覆盖说明。
Open Summarize by area. Choose a polygon boundary layer and run the summary. Whole buildings intersecting a zone are counted in that zone.|打开“按区域汇总”。选择多边形边界图层并执行汇总。与某分区相交的完整建筑会计入该分区。
Inspect the new boundary layer and table. Buildings crossing boundaries can count in more than one zone; summed zone counts can exceed the unique input count.|检查新的边界图层和属性表。跨界建筑可能计入多个分区，因此各分区数量之和可能超过输入中的独立建筑数。
Use the normal Project dependencies tool to verify native files and package complete results. With no native dependencies, downloading a Project file is enough.|使用常用的“Project 数据依赖”工具校验本地文件，并打包完整结果。如果没有本地引擎数据依赖，可直接下载 Project 文件。
Check the exported Project or package, its source dependencies, and the instructions for opening it on the receiving computer. Public basemaps and remote data still need internet access.|检查导出的 Project 或数据包、来源依赖，以及在接收电脑上打开的说明。公共底图和远程数据仍然需要联网访问。
Open Projects and confirm the map you want to hand over. Use the current Project when you are ready.|打开 Projects，确认要交接的地图。准备好后，选择使用当前 Project。
The handoff belongs to this Project and its current map settings.|交接成果对应此 Project 和当前地图设置。
Open Project dependencies. Check which original files are local and which sources remain online.|打开“Project 数据依赖”，检查哪些原始文件保存在本地，哪些来源仍需联网访问。
A preview does not contain the full native result. A complete package carries local result files.|预览不包含完整的本地结果。完整数据包会包含本地结果文件。
A Project file preserves an editable map. Native dependencies need a full package or verified files on the receiving computer.|Project 文件保留可继续编辑的地图。本地引擎数据依赖需要完整数据包，或接收电脑上经过校验的文件。
Creating a package is confirmed only after the complete files have been verified and written.|完整文件经过校验并写入后，才会确认数据包已创建。
Save the editable Project and keep the exported handoff with its source notes.|保存可编辑的 Project，并将导出的交接成果与来源说明一起保留。
Guide progress is separate from the Project. The receiving computer can open the Project file or verify and restore the package.|引导进度与 Project 分别管理。接收电脑可以打开 Project 文件，或校验并恢复数据包。
Save one study area for both sources before comparing them.|比较前，请为两个来源保存同一个研究区域。
Current Project|当前 Project
I have checked the dependencies|我已检查数据依赖
Use current Project|使用当前 Project
Opening processing or creating a plan does not create a result. Run the task, then choose its completed result.|打开处理工具或创建计划并不会生成结果。请执行任务，然后选择已完成的结果。
Use the tool to produce a result before continuing.|请先使用工具生成结果，再继续。
Merge result|Merge 结果
Choose the completed Merge result|选择已完成的 Merge 结果
This processing task used a different input. Choose the task for this workset and record scope.|此处理任务使用了不同的输入。请选择与当前分析数据集和记录范围相符的任务。
Choose an analysis workset.|请选择固定分析数据集。
Result ready. Return to the guide to review it.|结果已生成，请返回引导检查。
Download selected records|下载选中记录
Inspect result records|检查结果记录
Open result tool|打开结果工具
Download result data|下载结果数据
Use a complete Project package for native result files.|包含本地引擎结果文件时，请使用完整的 Project 数据包。
Complete Project package created|完整 Project 数据包已创建
Project file downloaded|Project 文件已下载
Data file downloaded|数据文件已下载
Selected records downloaded|选中记录已下载
Chart generated|图表已生成
Source comparison complete|来源比较已完成
Data quality report ready|数据质量报告已生成
Area summary layer created|区域汇总图层已创建
These buttons open the same tools used by the toolbar and layer menus.|这些按钮与工具栏、图层菜单中的功能使用同一个入口。
Goal categories|目标类别
Back|返回
Saved selection result|已保存的选择集结果
Choose the completed selection result|选择已完成的选择集结果
Numeric field|数值字段
No numeric value|没有可用数值
Colors show the selected numeric field. Missing or text values use gray.|颜色表示所选数值字段；缺失值或文本值显示为灰色。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
