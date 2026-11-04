/* Translate interface/system strings only; release IDs, schema fields and records stay raw. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Pinned release|固定数据版本
Checks every 5 min|每 5 分钟检查更新
Source records|来源记录数
Citation|引用说明
Permanent dataset identifier|永久数据标识
Not provided by this publication|本次发布未提供
Pinned manifests preserve expected versions. Upstream original file keys may be replaced; unavailable or changed bytes fail verification.|固定清单保存预期版本。上游原始文件地址可能被覆盖；文件不可用或内容变化时，校验将失败。
This older Project follows the latest USBF source. Choose a pinned release and save a new revision for reproducible data.|此旧版 Project 跟随 USBF 来源最新版本。若需可复现数据，请选择固定版本并保存新的修订。
Retain per-record component rights. Sharing a map does not relicense its data.|保留每条记录各组成部分的使用条款；分享地图不会重新授权其中的数据。
Published part bounds guide file selection. Real-world coverage and full-geometry bounds guarantees are not certified by this release.|已发布分块的边界用于选择文件。本次发布未保证现实世界的覆盖完整性，也未认证这些边界涵盖全部完整几何。
FROZEN MAP|固定内容地图
Share an interactive map|分享交互地图
Close sharing|关闭分享
The shared viewer allows navigation, layer visibility and attribute inspection. It cannot edit the publisher’s Project.|共享查看器支持移动地图、切换图层显示与查看属性，不会编辑发布者的 Project。
Map title|地图标题
Also include hidden layers and models|同时包含隐藏的图层与模型
Hidden layers are omitted by default. Native result files and engine credentials are not shared; bounded previews are labelled. Source component rights remain in force.|默认不包含隐藏图层。本地引擎结果文件与连接凭据不会分享；限量预览会明确标记。来源各组成部分的使用条款仍然有效。
Prepare shared map|准备共享地图
Copy interactive link|复制交互链接
Download shared HTML|下载共享 HTML
Open read-only preview|打开只读预览
Shared map link|共享地图链接
Shared HTML requires internet access to the USBF renderer and public sources. Large maps use a downloaded file instead of a URL; nothing is uploaded to cloud storage.|共享 HTML 需要联网访问 USBF 地图程序与公共来源。较大的地图通过下载文件分享，不生成链接；此操作不会上传云端存储。
Copy current camera link|复制当前视角链接
A camera link only records the current view and source connections. It does not include local files or custom basemaps.|视角链接仅记录当前视角与来源连接，不包含本地文件或自定义底图。
Preparing a frozen shared map…|正在准备固定内容的共享地图…
Frozen map ready. The recipient can explore it without editing your Project.|共享地图已就绪。接收者可交互查看，不会编辑你的 Project。
Interactive link copied.|交互链接已复制。
Select and copy the shared link.|请选择并复制共享链接。
Camera link copied.|视角链接已复制。
shared layers|个共享图层
embedded file bytes|字节嵌入文件
native previews only|个仅含本地结果预览的图层
Online data policy|在线数据版本策略
Pin archived data releases|固定已归档的数据版本
Follow latest sources|跟随来源最新版本
Layers, styles, view, drawings, models and map layout are included. Supported sources use the saved pinned or latest policy. Native previews require their original workspace for full analysis.|包括图层、样式、视角、绘图、模型与地图排版。支持的来源按保存的策略固定版本或跟随最新版本。本地结果预览需要原工作区才能进行完整分析。
Project opened. Some native files are unavailable; saved previews remain display-only.|Project 已打开。部分本地文件不可用；保存的预览仅供显示。
Project opened. Pinned sources retain their saved release; latest sources reconnect explicitly.|Project 已打开。固定版本来源保留保存时的版本；跟随最新策略的来源重新连接。
Project file opened as a separate copy. Some native files are unavailable; saved previews remain display-only.|Project 文件已作为独立副本打开。部分本地文件不可用；保存的预览仅供显示。
Read-only · your changes affect this view only|只读查看 · 操作仅影响当前视图
Sources and dependencies|来源与依赖
Map layers|地图图层
Attribute layer|属性图层
Captured {date}|保存时间：{date}
Contents checksum: {checksum}|内容校验值：{checksum}
The checksum detects changed contents; it is not a publisher identity signature.|内容校验值用于检测内容变化，不是发布者身份签名。
Published source|已发布来源
Latest endpoint or embedded records|最新来源地址或嵌入记录
Embedded source records|嵌入来源记录
Retain the source component rights|保留来源各组成部分的使用条款
{name}: only {count} preview records are included. The full native analysis file is not part of this share.|{name}：仅包含 {count} 条预览记录；此共享地图不包含完整的本地分析文件。
Published sources require internet access. Embedded worksets keep their original values; a source coverage claim is not inferred from the visible extent.|已发布来源需要联网访问。嵌入数据集保留原始值；当前可见范围不代表来源覆盖完整。
Click a building on the map to inspect its displayed attributes. Tile fragments are display records, not a complete analytical dataset.|点击地图上的建筑以查看显示属性。瓦片片段是显示记录，不是完整的分析数据集。
{shown} displayed rows; {count} loaded or selected records. Field names and original values are unchanged.|显示 {shown} 行；已加载或选中 {count} 条记录。字段名与原始值保持不变。
Checking shared map…|正在检查共享地图…
This view contains bounded previews. Full local analysis files were not shared.|当前视图包含限量预览，未分享完整的本地分析文件。
Read-only map loaded. Changes here do not edit the publisher’s Project.|只读地图已加载，此处的操作不会编辑发布者的 Project。
Waiting for shared map…|正在等待共享地图…
The shared map wrapper is still loading.|共享地图查看器仍在加载。
This shared map exceeds 64 MiB. Hide unneeded layers or save a smaller project.|此共享地图超过 64 MiB。请隐藏不需要的图层或保存较小的 Project。
This map is too large for a link. Download a shared HTML file instead.|此地图超过链接容量限制，请下载共享 HTML 文件。
The shared map link is too large.|共享地图链接过大。
The shared map link is invalid.|共享地图链接无效。
The shared map link format is unsupported.|不支持此共享链接格式。
The shared map decompressed beyond its size limit.|共享地图解压后超过容量限制。
This browser cannot open compressed share links. Use the shared HTML file.|当前浏览器无法打开压缩的共享链接，请使用共享 HTML 文件。
The shared map checksum does not match its contents.|共享地图的校验值与内容不一致。
Choose a valid USBF shared map.|请选择有效的 USBF 共享地图。
A shared source has an invalid URL.|共享来源的 URL 无效。
Shared maps require public HTTPS sources without credentials or local addresses.|共享地图需要公开的 HTTPS 来源，不能包含凭据或本地地址。
A source URL contains credentials. Use a public source before sharing.|来源 URL 包含凭据，请先改为公开来源再分享。
Pin the USBF release before sharing a reproducible map.|分享可复现地图前，请先固定 USBF 数据版本。
Choose pinned or latest data.|请选择固定版本或跟随最新版本。
The release registry is unavailable.|数据版本目录不可用。
The data release reference is invalid.|数据版本引用无效。
The pinned data release is missing its identity or checksums.|固定版本缺少版本标识或校验值。
The display map and original records do not belong to the same data release.|显示地图与原始记录不属于同一数据版本。
A pinned data release dependency changed. The current map was kept.|固定版本的依赖内容已变化，保留了当前地图。
The data release catalog is invalid.|数据版本目录无效。
The pinned data release is not available in this site.|当前网站不包含所需的固定数据版本。
The pinned data release checksums do not match the catalog.|固定版本的校验值与目录不一致。
This source release has not been archived by the site yet. Save a fixed workset, or explicitly follow the latest source.|网站尚未归档此数据版本。请保存固定分析数据集，或明确选择跟随来源最新版本。
Release documentation does not match the original publication.|版本文档与原始发布内容不一致。
The saved native source reference is invalid.|保存的本地来源引用无效。
Connect the original native workspace to analyze this saved preview.|请连接原本地引擎工作区，以分析此已保存预览的完整数据。
The pinned source does not match the saved catalog layer.|固定来源与保存的目录图层不一致。
This pinned release needs a full checksum-verified shard read. Use the local engine for this area.|此固定版本需要读取整个分块并核对校验值。此区域请使用本地引擎。
A pinned original shard changed size. Its saved release cannot be reproduced.|固定版本的原始分块大小已变化，无法复现保存的版本。
A pinned original shard exceeded its saved byte count.|固定版本的原始分块超过保存的字节数。
A pinned original shard arrived incomplete.|固定版本的原始分块未完整接收。
A pinned original shard no longer matches its saved SHA256. The old release is unavailable.|原始分块与固定版本保存的 SHA256 不一致，旧版本已不可用。
`.trim().split('\n')){const separator=line.indexOf('|'),key=line.slice(0,separator);if(separator>0&&!Object.prototype.hasOwnProperty.call(dictionary,key))dictionary[key]=line.slice(separator+1);}
})();
