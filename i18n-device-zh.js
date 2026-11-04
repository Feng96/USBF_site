/* Device/files interface only. Filenames, data values and format names remain opaque. */
Object.assign(window.PortalTranslations['zh-CN'], Object.fromEntries(`
Local resources and verified cache|本地资源和已验证缓存
Execution location|执行位置
Verified source-cache size|已验证源数据缓存大小
Source-cache target|源数据缓存目标
Protected unfinished-task cache|受保护的未完成任务缓存
Reused verified downloads|已复用的已验证下载次数
CPU threads|CPU 线程数
Memory limit (MiB)|内存限制 (MiB)
Source-cache target (MiB)|源数据缓存目标 (MiB)
The cache exceeds its soft target. Clean unused cache after active tasks finish.|缓存超过软限制，请在当前任务结束后清理不再使用的缓存。
Resource settings apply to new native connections. Finish or cancel active tasks before changing them.|资源设置用于后续本地连接，请先结束或取消当前任务。
The cache target is soft. Unfinished-task checkpoints, Projects, Results and Files are always kept. Cleanup removes only checksum-verified disposable files.|缓存目标为软限制。始终保留未完成任务的检查点、Projects、Results 和 Files。清理仅移除通过校验的可清理文件。
Save resource settings|保存资源设置
Refresh native cache|刷新本地缓存
Clean unused native cache|清理未使用的本地缓存
Run local health checks|运行本地健康检查
Local health checks passed|本地健康检查通过
Some local health checks need attention|部分本地健康检查需要处理
Native resource settings saved.|本地资源设置已保存。
Clean unused native cache?|清理未使用的本地缓存？
Only verified disposable native cache files will be removed. Results, source files, projects and unfinished-task checkpoints are kept.|只移除通过校验的可清理本地缓存文件。保留结果、源文件、项目和未完成任务的检查点。
Unused native cache cleaned. User data and unfinished tasks were kept.|未使用的本地缓存已清理，用户数据和未完成任务已保留。
Update the local engine to use resource settings, diagnostics and safe native-cache cleanup.|请更新本地引擎以使用资源设置、健康检查和安全缓存清理功能。
Local engine cache|本地引擎缓存
Verified native downloads are reused across tasks. Inspect their size and clean unused native cache in Local engine settings.|已验证的本地下载会在任务间复用。请在本地引擎设置中查看大小并清理未使用的缓存。
Open native cache settings|打开本地缓存设置
files|个文件
Native runtime caches are managed by the local engine.|本地运行环境缓存由本地引擎管理。
Native caches and task checkpoints are managed by the local engine and are read-only here. Browser cache cleanup never deletes them.|本地缓存和任务检查点由本地引擎管理，在此处只读。浏览器缓存清理不会删除它们。
Device settings|设备设置
WORKSPACE SETTINGS|工作区设置
Overview|概览
Local files|本地文件
Storage & cache|存储与缓存
Local engine|本地引擎
Advanced|高级设置
Browser · this computer|浏览器 · 这台电脑
Local engine · not connected|本地引擎 · 未连接
Cloud compute · not configured|云端计算 · 未配置
Know where your data runs|明确数据在哪里处理
Browsing and current analysis run in this browser on your computer. Cloud data hosting is separate from cloud computation.|浏览和当前分析在这台电脑的浏览器中运行，云端数据托管与云端计算分别标识。
Input data|输入数据
Your files|用户文件
Computation|执行计算
Results|结果
Browser or selected local folder|浏览器或已选本地文件夹
One parent folder for your workspace|工作区使用同一个母文件夹
Workspace parent|工作区母文件夹
No folder connected|尚未连接文件夹
Folder access granted|文件夹访问已授权
Folder access granted.|文件夹访问已授权。
Folder needs permission|文件夹需要访问权限
Choose a folder to enable disk files|选择文件夹后启用磁盘文件管理
Choose parent folder|选择母文件夹
Change parent folder|更换母文件夹
Grant folder access|授予文件夹访问权限
Disconnect folder|断开文件夹连接
Saved project files|已保存的项目文件
Exported results|导出的结果
Managed snapshot cache|受管理的快照缓存
Your imported files|用户导入的文件
Reserved native runtime folder|预留的本地运行环境文件夹
Choose or create a USBF parent folder. These default folders are siblings inside it.|选择或创建一个 USBF 母文件夹，各默认文件夹都位于其中同一层级。
Browse local files|浏览本地文件
Projects in a real folder|保存在磁盘文件夹中的项目
Browser projects remain in the browser library. When a folder is connected, saving a project also writes its disk copy under Projects.|项目仍保存在浏览器项目库中；连接文件夹后，保存项目也会将磁盘副本写入 Projects。
Open browser project library|打开浏览器项目库
Changing or disconnecting the parent folder does not move or delete previous files.|更换或断开母文件夹不会移动或删除原有文件。
This browser does not support writable folder access. Use a supported desktop browser, or use file imports and downloads.|当前浏览器不支持可写文件夹访问，请使用支持的桌面浏览器，或通过文件导入和下载操作。
Only the selected folder is accessible. The website cannot browse the rest of your computer.|网站只能访问已选择的文件夹，无法浏览电脑上的其他目录。
Open a file with Add Data|通过“添加数据”打开文件
Copy files here|复制文件到此处
Copy files to Files|将文件复制到 Files
New folder|新建文件夹
Folder path|文件夹路径
Search filenames|搜索文件名
Size|大小
Modified|修改时间
Type|类型
Copy adds files to the current folder without replacing existing files.|将文件复制到当前目录，已有同名文件不会被替换。
The Engine folder is reserved for the native program and is read-only in the browser.|Engine 文件夹为本地程序预留，在浏览器中只读。
Managed cache files are removed through the cache cleanup controls, which verify ownership.|受管理缓存需通过缓存清理入口移除，清理时会验证文件归属。
Reading folder…|正在读取文件夹…
Folder|文件夹
File|文件
No matching files|没有匹配的文件
Open folder|打开文件夹
Open project|打开项目
Open cached analysis layer|打开缓存的分析图层
Download file|下载文件
Rename|重命名
Delete file|删除文件
Choose a file to view its available actions.|选择文件后查看可用操作。
listed entries|条已列出记录
Listing limit reached; use smaller folders.|已达到列表上限，请使用较小的文件夹。
Workspace parent folder|工作区母文件夹
Projects, Results, Cache, Files and Engine share this parent. Changing the parent leaves previous folders untouched.|Projects、Results、Cache、Files 和 Engine 使用同一母文件夹；更换母文件夹会保留原有目录。
Disk snapshot cache|磁盘快照缓存
Cached files|缓存文件数
Cache size|缓存大小
Cache inventory is limited; totals cover listed files only.|缓存清单达到上限，统计只包含已列出的文件。
Cache loaded analysis snapshots on disk|将已加载的分析快照缓存到磁盘
Off by default. Completed original analysis snapshots can be saved as GeoJSON under Cache/browser-v1 when this option is enabled.|默认关闭。启用后，已完成加载的原始分析快照可作为 GeoJSON 保存到 Cache/browser-v1。
This disk cache is separate from map tiles and source-worker memory caches.|磁盘缓存与地图瓦片及数据读取工作线程的内存缓存分别管理。
Refresh cache size|刷新缓存大小
Browse cache files|浏览缓存文件
Clear managed disk cache|清理受管理磁盘缓存
Browser map cache|浏览器地图缓存
Clear current map and source-reader caches while keeping current work, saved browser projects and local files.|清理当前地图和数据读取缓存，保留当前工作、已保存的浏览器项目和本地文件。
Clear browser map cache|清理浏览器地图缓存
Your projects and results|用户项目与结果
Project and result files are user data. Cache cleanup never deletes them. Remove an individual file only through the file manager confirmation.|项目和结果是用户数据，缓存清理不会删除它们。删除单个文件需通过文件管理器确认。
Browse Projects|浏览 Projects
Browse Results|浏览 Results
Local native engine|本地原生引擎
Connection|连接状态
Not connected|未连接
Installation package|安装包
No native installer released|尚未发布本地安装包
Execution now|当前执行位置
No native installer is available yet. This page does not simulate installation, connection or hardware statistics.|尚未提供本地安装包。此页面不模拟安装、连接或硬件统计。
Install local engine|安装本地引擎
Connect local engine|连接本地引擎
Uninstall local engine|卸载本地引擎
An unreachable local service would not prove the program is uninstalled. Native connection and pairing will be available with the companion release.|本地服务无法连接并不代表程序未安装，连接和配对功能将随本地程序发布提供。
Information after connection|连接后显示的信息
The native program will report its version, runtime, CPU and memory capacity, disk usage and active tasks. These values are not guessed from the browser.|本地程序将报告版本、运行环境、CPU 和内存容量、磁盘占用及运行任务，这些信息不会由浏览器猜测。
View the separate interaction prototype|查看独立交互原型
The prototype uses simulated data and actions; it is not an installer.|交互原型使用模拟数据和操作，并非安装程序。
Managed environment by default|默认使用自带独立环境
The planned companion uses an isolated USBF runtime with pinned GDAL, PROJ and DuckDB components. Existing GIS and Python installations stay independent.|本地程序计划使用独立 USBF 环境并固定 GDAL、PROJ 和 DuckDB 组件版本，已有 GIS 和 Python 软件保持独立。
Runtime selection|运行环境选择
USBF-managed runtime · planned|USBF 自带运行环境 · 计划提供
Custom environments will require explicit selection, compatibility checks and a separate worker process. Detection will not automatically switch the runtime.|自定义环境需要明确选择、兼容性检查和独立工作进程；检测不会自动切换运行环境。
Inspect existing environments|检测已有运行环境
Requires a released and paired local engine.|需要已发布并完成配对的本地引擎。
Access and data boundaries|访问与数据边界
Folder access is limited to the selected workspace parent and can be disconnected. User filenames and data values are never translated.|文件夹访问仅限已选择的工作区母文件夹，可以随时断开；用户文件名和数据值保持原样。
Engine runtime files are read-only here. Cleanup only removes cache entries owned by USBF, while projects, results and external environments are kept.|本地运行环境文件在此只读。清理仅移除 USBF 所属缓存，保留项目、结果和外部环境。
Folder access is optional; browser projects remain available.|文件夹连接为可选功能，浏览器项目仍可使用。
Folder connection is available only in this session.|文件夹连接仅在本次会话中可用。
The cache preview is limited. Totals include all verified managed entries.|缓存预览达到上限，统计包含所有已验证的受管理缓存记录。
Create folder|创建文件夹
The new folder will be inside the current workspace folder.|新文件夹将位于当前工作区目录内。
Folder name|文件夹名称
Choose a file first.|请先选择文件。
Delete this local file?|删除此本地文件？
Only this selected file will be removed. Other files and folders are kept.|只移除当前选中的文件，其他文件及目录会保留。
Confirm delete|确认删除
Rename local file|重命名本地文件
Existing files will not be overwritten.|已有文件不会被覆盖。
New filename|新文件名
File deleted.|文件已删除。
File renamed.|文件已重命名。
File download started.|文件下载已开始。
Files copied without replacing existing files.|文件已复制，原有文件未被替换。
The Engine folder is read-only.|Engine 文件夹为只读。
Use Add Data to open this file and set its import options.|请通过“添加数据”打开此文件并设置导入选项。
Workspace parent connected.|工作区母文件夹已连接。
Folder disconnected. Existing files were kept.|文件夹连接已断开，原有文件已保留。
Project file saved in Projects.|项目文件已保存到 Projects。
Clear managed disk cache?|清理受管理磁盘缓存？
Only USBF-owned snapshot cache entries will be removed. Projects, results and user files are kept.|只移除 USBF 所属的快照缓存，保留项目、结果和用户文件。
Managed disk cache cleared. User files were kept.|受管理磁盘缓存已清理，用户文件已保留。
Some managed cache entries remain. Run cleanup again.|仍有部分受管理缓存，请再次运行清理。
Cache cleanup kept changed or unrecognized files.|缓存清理保留了已改变或无法识别的文件。
Browser map cache cleared. Local files were kept.|浏览器地图缓存已清理，本地文件已保留。
Disk snapshot caching enabled.|磁盘快照缓存已启用。
Disk snapshot caching disabled.|磁盘快照缓存已关闭。
Remove the layer or model using this file before deleting or renaming it.|删除或重命名前，请先移除正在使用该文件的图层或模型。
Use the managed cache cleanup controls for these files.|请通过受管理缓存清理入口处理这些文件。
Choose a valid file or folder name.|请选择有效的文件或文件夹名称。
Choose a path inside the connected USBF folder.|请选择已连接 USBF 文件夹内的路径。
Choose a path inside a USBF workspace folder.|请选择 USBF 工作区文件夹内的路径。
Engine files are managed by the native installer.|Engine 文件由本地安装程序管理。
Folder access is unavailable. Reconnect and allow access to the USBF folder.|文件夹访问不可用，请重新连接并授予 USBF 文件夹访问权限。
This local file or folder no longer exists. Refresh the file list.|此本地文件或文件夹已不存在，请刷新文件列表。
The selected disk has insufficient space. Choose another workspace folder.|所选磁盘空间不足，请选择其他工作区文件夹。
This browser cannot remember the folder.|当前浏览器无法记住此文件夹连接。
Close other USBF tabs and reconnect the folder.|请关闭其他 USBF 标签页，然后重新连接文件夹。
The folder connection could not be remembered.|无法记住此文件夹连接。
Connect a local USBF folder first.|请先连接本地 USBF 文件夹。
Reconnect and allow access to the USBF folder.|请重新连接并授予 USBF 文件夹访问权限。
This browser does not support connected folders. Use file import and download, or a supported desktop browser.|当前浏览器不支持连接文件夹，请通过文件导入和下载操作，或使用支持的桌面浏览器。
Allow folder access to use the local workspace.|请授予文件夹访问权限以使用本地工作区。
The saved folder is ready. Click reconnect again to allow access.|已保存的文件夹已就绪，请再次点击重新连接以授予访问权限。
Choose a file inside a workspace folder.|请选择工作区文件夹内的文件。
Choose a new folder inside a workspace folder.|请在工作区文件夹内选择新文件夹。
Too many files have this name. Choose another file name.|使用此名称的文件过多，请选择其他文件名。
Choose a local file to import.|请选择要导入的本地文件。
Import user data into Files or Results.|请将用户数据导入 Files 或 Results。
Choose result data to save.|请选择要保存的结果数据。
This project is invalid or too large to save locally.|此项目无效或过大，无法保存到本地。
This project has no valid persistent identity.|此项目缺少有效的持久标识。
The local project file has a newer or different revision. Open it or save a project copy.|本地项目文件的修订较新或内容不同，请打开该文件或另存项目副本。
The project name conflicts with existing local files. Save a project copy.|项目名称与已有本地文件冲突，请另存项目副本。
Workspace folders cannot be deleted here.|无法在此删除工作区文件夹。
Only individual files can be deleted.|只能删除单个文件。
Workspace folders cannot be renamed here.|无法在此重命名工作区文件夹。
A file with this name already exists.|已有同名文件。
A folder with this name already exists.|已有同名文件夹。
The original file changed during rename. Both copies were kept. Refresh the file list.|重命名期间原文件发生变化，两个副本均已保留，请刷新文件列表。
The copy was saved, but the original could not be removed. Both files were kept.|副本已保存，但无法移除原文件，两个文件均已保留。
The cache folder contains an unknown index. Its files were kept.|缓存文件夹包含无法识别的索引，其中的文件已保留。
The cache index has too many entries. Its files were kept.|缓存索引包含过多记录，其中的文件已保留。
The cache index is invalid. Its files were kept.|缓存索引无效，其中的文件已保留。
This cache index was not created by this browser. Its files were kept.|此缓存索引并非由当前浏览器创建，其中的文件已保留。
The cache index is too large. Its files were kept.|缓存索引过大，其中的文件已保留。
The cache index changed outside USBF. Its files were kept.|缓存索引在 USBF 外被修改，其中的文件已保留。
The cache index budget was exceeded.|缓存索引超出大小限制。
Choose a valid cache key.|请选择有效的缓存键。
Secure cache keys are unavailable in this browser.|当前浏览器无法使用安全缓存键。
This cache entry exceeds the 256 MiB browser write budget.|此缓存记录超过浏览器单次写入 256 MiB 的限制。
Cache metadata is too large.|缓存元数据过大。
The local cache index is full. Clear unused cache first.|本地缓存索引已满，请先清理不再使用的缓存。
The managed cache exceeds its 256 MiB budget. Clear unused cache before saving more.|受管理缓存超过 256 MiB 的限制，请先清理不再使用的缓存再继续保存。
`.trim().split('\n').map(row=>{const i=row.indexOf('|');return [row.slice(0,i),row.slice(i+1)];})));
