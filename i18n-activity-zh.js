/* Activity controls are translated; original source names and retained values stay raw. */
(function(){const d=window.PortalTranslations?.['zh-CN'];if(!d)return;for(const line of `
Tasks & results|任务与成果
Tasks & outcomes|任务与成果
Source comparison|来源比较
Measure|指标
Observations|观测数
Median|中位数
Sum|总和
Standard deviation|标准差
Crossing buildings may be counted in more than one zone.|跨界建筑可能被计入多个区域。
Coverage|覆盖情况
WORKSPACE ACTIVITY|工作区动态
Scope|范围
Records read|已读取记录
Updated|更新时间
Input scope not recorded|未记录输入范围
Activity views|动态视图
Results|成果
Result layer|结果图层
Chart snapshot|图表快照
Summary snapshot|统计快照
Area summary|分区统计
Data download|数据下载
Project file|Project 文件
Complete Project package|完整 Project 数据包
Map export|地图导出
Sent to browser|已交给浏览器下载
Created|已生成
Input|输入
Storage|保存位置
Path|路径
Layer in this Project|此 Project 中的图层
Result snapshot included when this Project is saved|保存 Project 时会包含此成果快照
Download sent to your browser; its final file location is managed by your browser.|已交给浏览器下载；最终文件位置由浏览器管理。
Saved to the connected Results folder|已保存到已连接的 Results 文件夹
Complete file in the local workspace|本地工作区中的完整文件
Complete package in the local workspace|本地工作区中的完整数据包
Map output sent to your browser|已交给浏览器下载地图成果
Storage location not recorded|没有记录保存位置
Full local result reference; availability is verified when opened|本地完整结果的引用，打开时会校验可用性
Local package reference; availability is verified when opened|本地数据包的引用，打开时会校验可用性
Result records|结果记录数
Snapshots keep the values recorded when they were created. Later input changes do not recalculate saved results.|快照保留生成时的数值，后续更改输入不会重新计算已保存的成果。
Input scope not recorded|没有记录输入范围
No result snapshot was retained. Use the original tool or result file.|没有保留成果快照，请使用原工具或结果文件。
This snapshot was too large to retain. Download it from the original tool before replacing the result.|此快照过大，未保留在成果历史中。请在替换结果前，从原工具下载。
This result exceeds the snapshot limits. Download it from the original tool before replacing it.|此成果超出快照保留限制。请在替换结果前，从原工具下载。
Saved chart snapshot|已保存的图表快照
Values and labels are available in the table below.|数值和标签可在下方表格查看。
Showing the first 100 rows. Downloads include the retained snapshot values.|这里显示前 100 条；下载包含保留的快照数值。
View saved result|查看已保存成果
Download result JSON|下载成果 JSON
Download retained values CSV|下载保留数值 CSV
Download snapshot SVG|下载快照 SVG
View task|查看任务
Connect the workspace containing this result.|请连接保存此结果的工作区。
active tasks|个运行中任务
tasks need attention|个任务需要处理
Open tasks and saved result snapshots|打开任务与已保存成果快照
No tasks yet. Start by loading data or running a tool.|暂无任务，可先加载数据或运行工具。
No results yet. Completed tools will leave a result card here.|暂无成果，工具完成后会在这里保留成果卡。
Tasks keep running when this panel is closed. Result snapshots are included when you save the Project; downloaded files stay managed by your browser or local workspace.|关闭此面板不会停止任务。保存 Project 时会包含成果快照；下载文件由浏览器或本地工作区管理。
Projects retain up to 32 outcome cards and 2 MiB of result snapshots. Large results keep their location and availability notes.|Project 最多保留 32 张成果卡和 2 MiB 的成果快照。较大的结果会保留位置与可用情况说明。
This result is no longer available.|此成果已不可用。
Download sent to your browser.|已交给浏览器下载。
The saved outcomes list is invalid or too large.|保存的成果列表无效或过大。
A saved outcome is invalid.|保存的成果无效。
The saved result snapshot is invalid.|保存的成果快照无效。
The saved result snapshot is too large.|保存的成果快照过大。
The saved result snapshot is too complex.|保存的成果快照过于复杂。
The saved result snapshot has too many values.|保存的成果快照包含过多数值。
The saved result snapshot contains an unsupported field.|保存的成果快照包含不支持的字段。
The saved chart snapshot is invalid.|保存的图表快照无效。
The saved chart values are invalid.|保存的图表数值无效。
The saved area summary is invalid.|保存的分区统计无效。
The saved comparison is invalid.|保存的比较结果无效。
The saved summary is invalid.|保存的统计结果无效。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)d[line.slice(0,i)]=line.slice(i+1);}})();
