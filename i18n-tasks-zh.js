/* Interface and system text only. Source fields, place names, paths and formats stay opaque. */
(function () {
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Tested operating system|已测试操作系统
Browser loading limits: 20,000 records, 64 parts and 96 MiB. Spatial overlays: up to 1,500 input records.|浏览器加载限制：20,000 条记录、64 个分块和 96 MiB。空间叠加最多使用 1,500 条输入记录。
Choose a saved study area for a source estimate.|请选择已保存的研究区域以估计来源数据量。
Source estimate unavailable; actual counts are recorded by the task.|无法估计来源数据量；任务将记录实际数量。
Upper bounds before spatial filtering.|空间筛选前的上限。
source parts|个来源分块
full result records|条完整结果记录
records in the native result file|条记录保存在本地结果文件中
preview records in the browser|条预览记录保存在浏览器中
Full native result stays in Results; the map contains a bounded preview|完整本地结果保存在 Results，地图仅包含限量预览
Partial native result; resume failed parts in Task center|本地结果尚未完整；请在任务中心继续失败的分块
This is a bounded native preview. Process its full result with the local engine.|此图层为限量本地预览，请使用本地引擎处理其完整结果。
Charts need a fixed browser workset. The bounded native preview is not the full analytical input.|Charts 需要固定的浏览器分析数据集；限量本地预览不包含完整分析输入。
Package revision|安装包修订
Code signature|代码签名
Signed|已签名
Unsigned preview|未签名预览版
Not reported|未报告
Run processing in|处理任务执行位置
Review native task plan|检查本地引擎任务计划
This operation runs in a browser workset. Choose Browser or another native operation.|此操作需要浏览器分析数据集，请选择浏览器或其他本地引擎操作。
Preview selection cannot filter a full native result. Choose all records or a saved study area.|预览中的选择不能筛选完整本地结果，请选择所有记录或已保存区域。
The full native input is processed outside the browser. Review estimates in Task center before starting.|完整本地输入将在浏览器外处理，执行前请在任务中心检查估计值。
This processing task runs in the browser with explicit input budgets.|此处理任务在浏览器中运行，并采用明确的输入容量限制。
The bounded preview cannot be a browser processing input. Choose the local engine.|限量预览不能作为浏览器处理输入，请选择本地引擎。
For native inputs, use the saved study area as the operation boundary, or extract that input area first as a separate native task.|本地输入请使用已保存区域作为操作边界，或先单独创建本地提取任务以得到该区域的输入数据。
Save a study area before using a map view as an analysis input.|将地图视野用于分析输入前，请先保存研究区域。
The map contains a bounded native preview. Use a saved study area instead of treating its preview extent as the full result extent.|地图仅包含限量本地预览，请使用已保存区域；预览范围不能代表完整结果范围。
The native table is paged. Save the complete GeoParquet result from the native table or Task center.|本地属性表采用分页读取。可在本地属性表或任务中心保存完整 GeoParquet 结果。
Save full result file|保存完整结果文件
Input record scope|输入记录范围
Native result · bounded map preview|本地结果 · 地图限量预览
Complete records stay in the local Results file. The map shows a bounded preview; tables and processing use the full native result.|完整记录保存在本地 Results 文件。地图仅显示限量预览；属性表与处理使用完整本地结果。
Bounded native preview|限量本地预览
This shared preview contains display records only. The full native result is a separate local dependency.|此分享预览仅包含显示记录，完整本地结果需另行提供。
The map contains a bounded native preview. Complete analytical records stay in the local result file; use the local engine and its paged table.|地图仅包含限量本地预览。完整分析记录保存在本地结果文件中，请使用本地引擎及分页属性表。
View full result table|查看完整结果属性表
Process full native result|处理完整本地结果
Bounded native preview · display records only|限量本地预览 · 仅供显示
BOUNDED PREVIEW|限量预览
Copy this source to the local Files folder and select it in a native task. Inline transfer is limited to 15 MiB.|请将此来源复制到本地 Files 文件夹，并在本地引擎任务中选择该文件。直接传输上限为 15 MiB。
This provider has no native original-data adapter yet. Use its bounded browser adapter or a regional file in Files.|此来源尚未提供本地原始数据读取器，请使用受限的浏览器读取器或 Files 中的区域文件。
Preview extent unavailable|无法使用预览范围
A bounded native preview cannot define the full result extent. Choose a saved study area.|限量本地预览不能代表完整结果范围，请选择已保存的研究区域。
Browse result folder|浏览结果文件夹
Choose the parent folder containing this native result. Its Engine workspace marker must match the task workspace.|请选择包含此本地结果的母文件夹，其 Engine 工作区标记必须与任务工作区匹配。
Source parts with unknown row counts|记录数未知的来源分块
Disk planning estimate|磁盘规划估计
Available local disk|本地可用磁盘
Unknown counts are shown as —. When source sizes are unknown, the disk planning estimate covers known files only; processing may need more space.|未知数量显示为 —。来源大小未知时，磁盘规划估计仅包含大小已知的文件，处理可能需要更多空间。
Pending|待处理
Tasks|任务
Full local result; bounded map display|完整本地结果；地图限量显示
Reading result table page…|正在读取结果属性表分页…
Rows per page|每页记录数
Long values are shortened for display. Complete values remain in the local result file.|较长的值仅缩短显示，完整值仍保存在本地结果文件中。
Native job checkpoints are managed by the local engine and are read-only here. Browser cache cleanup never deletes them.|本地任务检查点由本地引擎管理，在此仅可读取。浏览器缓存清理不会删除这些文件。
Task center|任务中心
DATA TASKS|数据任务
Close task center|关闭任务中心
History|历史记录
New native task|新建本地引擎任务
Refresh tasks|刷新任务
Engine settings|引擎设置
active tasks|个进行中的任务
Queued|等待中
Running|运行中
Cancelling|正在取消
Cancelled|已取消
Interrupted|已中断
Failed|失败
Partial|部分完成
Completed|已完成
Local engine · this computer|本地引擎 · 当前计算机
Choose a task to inspect its scope, progress and result.|选择任务以查看范围、进度和结果。
Operation|操作
Saved area|已保存区域
Source release|数据发布版本
Actual records|实际记录数
Completed source parts|已完成来源分块
Failed source parts|失败来源分块
Estimated source records|估计来源记录数
Estimated source bytes|估计来源数据量
Source estimates are upper bounds before spatial filtering. Request completion does not prove every real-world building exists in the provider dataset.|来源估计值为空间筛选前的上限。请求完成不代表数据提供方的数据集包含现实中的所有建筑。
Reader progress|读取进度
Cancel task|取消任务
Resume failed parts|继续失败分块
Retry browser read|重新执行浏览器读取
Add bounded preview|添加限量预览
View result table|查看结果属性表
Download task receipt|下载任务记录
Save result file|保存结果文件
Show result layer|显示结果图层
Resume keeps successful source-part checkpoints. The map preview and paged table are bounded; complete data stays in Results.|继续任务会保留已成功分块的检查点。地图预览和属性表分页均有限量；完整数据保存在 Results 中。
Browser retry starts a new read. It is not native checkpoint resume.|浏览器重试会开始一次新的读取；本地引擎才能从检查点继续。
Showing at most 1,000 source parts. Download the task receipt for the complete plan.|最多显示 1,000 个来源分块。下载任务记录可查看完整计划。
Source-part details|来源分块详情
Part|分块
No source-part receipt is available for this reader.|此读取器未提供来源分块记录。
Reading source metadata…|正在读取来源元数据…
Execution|执行位置
Source parts|来源分块
The estimate covers complete source parts before filtering. No task starts until you choose Start native task.|此估计包含筛选前的整个来源分块。选择“开始本地引擎任务”后才会执行。
Start native task|开始本地引擎任务
Back to tasks|返回任务列表
Process local source files|处理本地来源文件
Choose files copied into your engine workspace Files folder. Paths are relative to that workspace, never arbitrary computer paths.|请选择已复制到引擎工作区 Files 文件夹内的文件。路径相对于该工作区，不能填写计算机上的任意路径。
Load / extract whole records|加载／提取整条记录
Extract by saved boundary|按已保存边界提取
Source paths · one per line|来源路径 · 每行一个
List workspace files|列出工作区文件
Use the active saved study area|使用当前已保存的研究区域
Buffer distance · metres|Buffer 距离 · metres
Measurement CRS|测量 CRS
Buffer distances need a projected CRS with metre units. The selected CRS is recorded in the result receipt.|Buffer 距离需要使用单位为 metres 的投影 CRS。所选 CRS 将写入结果记录。
Estimate native task|估计本地引擎任务
No tasks yet. Loading an analysis workset creates a browser task; large tasks can run in the paired local engine.|暂无任务。加载分析数据集会创建浏览器任务；大规模任务可使用已配对的本地引擎运行。
result records|条结果记录
Only this table page is loaded in the browser.|浏览器中仅加载当前属性表分页。
Close result table|关闭结果属性表
Unknown before reading the source|读取来源前未知
Task history is available only in this session.|任务历史记录仅在本次会话中可用。
Close other USBF tabs to open task history.|请关闭其他 USBF 标签页以打开任务历史记录。
Task history could not be saved. Current tasks remain available in this session.|无法保存任务历史记录。当前任务仍可在本次会话中查看。
The browser closed before this task finished. Retry starts a new browser read.|任务完成前浏览器已关闭。重试将开始一次新的浏览器读取。
Run this loading task in|加载任务执行位置
Connect the local engine in Files & device|请在“文件与设备”中连接本地引擎
Runs in this browser with explicit safety budgets|在当前浏览器中运行，并采用明确的安全容量限制
Local engine connected · plan before execution|本地引擎已连接 · 执行前先检查计划
Native plan ready. Review and start it in Task center. Results remain in the local Results folder.|本地引擎任务计划已就绪。请在任务中心检查并启动。结果保存在本地 Results 文件夹。
Native engine processing|使用本地引擎处理
Native result|本地引擎结果
preview records|条预览记录
source files|个来源文件
source records|条来源记录
Metadata estimate before spatial filtering|空间筛选前的元数据估计
Exact in-area records are known after reading.|读取后才能确定区域内的实际记录数。
A native result keeps its complete data in the local Results folder. The browser holds a bounded preview only.|本地引擎结果的完整数据保存在本地 Results 文件夹，浏览器仅保存限量预览。
Save and choose a study area before planning a task.|请先保存并选择研究区域，再制定任务计划。
Versioned USBF source planning is still loading.|USBF 数据版本计划功能仍在加载。
Use the original file in the local Files folder for a large native task.|大规模本地任务请使用本地 Files 文件夹内的原始文件。
This source currently uses its browser pagination adapter. Load a browser workset or import its original regional file into the local Files folder.|此来源目前使用浏览器分页读取器。请加载浏览器分析数据集，或将原始区域文件导入本地 Files 文件夹。
Connect the workspace containing the full native result.|请连接保存完整本地结果的工作区。
Preview rows are display only. Choose the full native result or a saved study area.|预览记录仅供显示。请选择完整本地结果或已保存的研究区域。
Prepare a fixed analysis workset before processing it.|请先准备固定的分析数据集，再进行处理。
Connect the local engine in Files & device before planning a native task.|制定本地引擎任务计划前，请在“文件与设备”中连接本地引擎。
Review a task plan before starting it.|请先检查任务计划，再启动任务。
The engine workspace changed. Prepare the task plan again.|引擎工作区已改变，请重新制定任务计划。
Reconnect the workspace that owns this task.|请重新连接此任务所属的工作区。
Browser retry starts a new read. Checkpoint resume requires the local engine.|浏览器重试会开始一次新的读取；从检查点继续需要本地引擎。
This task has no resumable native checkpoint.|此任务没有可继续的本地检查点。
Reopen the original Project or source before retrying this browser task.|重试浏览器任务前，请重新打开原始 Project 或数据来源。
The original source is unavailable.|原始数据来源不可用。
Connect this task workspace first.|请先连接此任务的工作区。
No result preview records are available. The task receipt and result file remain available.|没有可预览的结果记录。仍可查看任务记录及结果文件。
Enter the local engine address shown by the desktop program.|请输入桌面程序显示的本地引擎地址。
The local engine must use http://127.0.0.1 and its local port.|本地引擎必须使用 http://127.0.0.1 和本地端口。
Invalid local engine request.|本地引擎请求无效。
Connect and pair the local engine first.|请先连接并配对本地引擎。
The local engine did not respond. Start the desktop program and allow the browser connection.|本地引擎没有响应。请启动桌面程序，并允许浏览器连接。
This local service is not a supported USBF engine.|此本地服务不是受支持的 USBF 引擎。
Enter the pairing code shown by the desktop program.|请输入桌面程序显示的配对码。
The engine returned an invalid pairing response.|引擎返回的配对信息无效。
Engine connection changed. Pair again with the current desktop program.|引擎连接已改变，请使用当前桌面程序重新配对。
The local engine status is invalid.|本地引擎状态无效。
This result is too large for a browser download. Open it from the local Results folder.|此结果过大，无法通过浏览器下载。请在本地 Results 文件夹打开。
Open this large result from the local Results folder.|请在本地 Results 文件夹打开此大型结果。
No matching engine workspace marker was found in the selected folder.|所选文件夹中没有匹配的引擎工作区标记。
Invalid native result path.|本地结果路径无效。
The local engine is not connected.|尚未连接本地引擎。
This Project references another local workspace.|此 Project 引用了另一个本地工作区。
The engine returned another result path.|引擎返回了其他结果路径。
The native result file is missing.|缺少本地结果文件。
The native result changed or its saved checksum cannot be verified.|本地结果已改变，或无法验证保存的校验和。
Uninstall from the desktop program. Project and result files are kept.|请在桌面程序中卸载。Project 和结果文件将保留。
The engine release information could not be loaded.|无法加载引擎发布信息。
The engine release information is invalid.|引擎发布信息无效。
Download installer|下载安装包
This preview installer is not code-signed. Your operating system may ask for confirmation.|此预览安装包未经过代码签名，操作系统可能要求确认。
Downloading a package does not install or start the engine. Run the installer, start USBF Engine, then enter its pairing code here.|下载安装包后，请运行安装程序并启动 USBF Engine，然后在此输入配对码。
Local engine connected|本地引擎已连接
Paired in this tab; engine unavailable|当前标签页已配对；引擎不可用
Execution now|当前执行位置
Browser map; native tasks run on this computer|地图在浏览器显示；本地引擎任务在当前计算机运行
Engine version|引擎版本
Workspace ID|工作区 ID
CPU count|CPU 数量
Available memory|可用内存
Free disk space|可用磁盘空间
Engine reported runtime and hardware|引擎报告的运行环境与硬件
Refresh engine status|刷新引擎状态
Open task center|打开任务中心
Check shared parent folder|检查共同母文件夹
Disconnect engine|断开引擎连接
Request desktop uninstall|请求桌面程序卸载
Uninstall requires confirmation in the desktop program. Projects, Results and Files are kept.|卸载须在桌面程序中确认，Projects、Results 和 Files 将保留。
Local engine address|本地引擎地址
Pairing code from desktop|桌面程序配对码
Check local engine|检测本地引擎
Connect using code|使用配对码连接
Forget pairing|移除配对
Start USBF Engine on this computer. Allow the browser local-network connection when it asks, then use the code displayed by the desktop program.|请在当前计算机启动 USBF Engine，允许浏览器请求的本地网络连接，然后使用桌面程序显示的配对码。
Install the isolated runtime|安装独立运行环境
The engine uses its own runtime under Engine. Existing GDAL, DuckDB, Python and GIS installations are not modified.|引擎使用 Engine 中的独立运行环境，不修改已有的 GDAL、DuckDB、Python 或 GIS 安装。
Native tasks run outside the browser. Cloud data hosting does not mean cloud computation.|本地引擎任务在浏览器外运行。数据托管于云端并不代表在云端计算。
Connect a released local engine to use native processing.|连接已发布的本地引擎后即可进行本地处理。
Local engine · connected|本地引擎 · 已连接
Local engine found. Enter the code from its desktop window to pair.|已检测到本地引擎。请输入桌面窗口中的配对码。
Local engine paired in this tab. Native tasks can now use the selected engine workspace.|当前标签页已与本地引擎配对。本地任务现在可使用所选引擎工作区。
Engine pairing forgotten in this tab. Running native tasks are kept by the desktop program.|当前标签页已移除引擎配对，正在运行的本地任务仍由桌面程序保留。
Pairing removed from this tab. The engine could not confirm token revocation; close the desktop program to revoke active connections.|当前标签页已移除配对。引擎未能确认令牌已撤销；关闭桌面程序可撤销活动连接。
Engine status updated.|引擎状态已更新。
The browser and engine use the same parent folder.|浏览器与引擎使用同一个母文件夹。
The selected browser folder belongs to another engine workspace. Choose the same parent before managing its result files.|浏览器所选文件夹属于另一个引擎工作区。请先选择同一个母文件夹，再管理结果文件。
Choose the engine workspace parent in Local files to compare the workspace marker.|请在“本地文件”中选择引擎工作区母文件夹，以比较工作区标记。
The desktop program will ask you to confirm uninstall. No project or result has been deleted by this page.|桌面程序将要求确认卸载，此网页没有删除任何 Project 或结果。
Remove the layer referencing this native result before deleting or renaming it.|删除或重命名前，请先移除引用此本地结果的图层。
Maps run in this browser. Loading and processing use the execution location chosen for each task. Cloud data hosting is separate from cloud computation.|地图在当前浏览器中显示。加载与处理使用每个任务选择的执行位置。云端数据托管与云端计算相互独立。
Browser and connected local engine|浏览器与已连接的本地引擎
The local engine requires a desktop computer. Continue in this browser on this device.|本地引擎需要桌面计算机。当前设备可继续使用浏览器功能。
`.trim().split('\n')){const separator=line.indexOf('|'),key=line.slice(0,separator);if(separator>0&&!Object.prototype.hasOwnProperty.call(dictionary,key))dictionary[key]=line.slice(separator+1);}
})();
