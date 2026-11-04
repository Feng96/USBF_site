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
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
