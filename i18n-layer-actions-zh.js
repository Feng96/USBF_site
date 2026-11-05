/* Layer operations share labels and explanations across every UI surface. */
Object.assign(window.PortalTranslations['zh-CN'],Object.fromEntries(`
Layer style|图层样式
Load original building records for a saved area with the local engine on a desktop computer.|请在桌面电脑上使用本地引擎，为已保存的区域加载原始建筑记录。
Compare sources|比较数据源
Choose a layer first.|请先选择图层。
Load a fixed analysis workset before using this operation.|请先加载固定分析数据集，再使用此操作。
Connect the workspace containing the full native result.|请连接包含完整本地结果的工作目录。
This layer contains display records only. Load original vector records first.|此图层仅包含显示记录，请先加载原始矢量记录。
Raster display layers do not supply vector records.|栅格显示图层不提供矢量记录。
Download original data from the provider. Display previews are not full-data exports.|请从提供方下载原始数据；显示预览不能作为完整数据导出。
No original-data adapter is available for this connection. Import an original file or choose another source.|此连接没有可用的原始数据适配器，请导入原始文件或选择其他来源。
Choose two building sources and a saved study area to compare.|请选择两个建筑数据源及已保存的研究区域进行比较。
Load at least two original building worksets for the same study area to compare.|请加载至少两个覆盖同一研究区域的原始建筑分析数据集，再进行比较。
This layer has no extent.|此图层没有范围信息。
This layer is already at the top.|此图层已在最上方。
This layer is already at the bottom.|此图层已在最下方。
Reopen the original raster to create an independent image copy.|请重新打开原始栅格，创建独立的图像副本。
Reopen the original PMTiles file to create an independent connection.|请重新打开原始 PMTiles 文件，创建独立连接。
A bounded native preview cannot define the extent of the full result. Use a saved study area.|有限的本地结果预览不能表示完整结果范围，请使用已保存的研究区域。
This layer has no failed request to retry.|此图层没有需要重试的失败请求。
This source has no automatic release refresh.|此来源不支持自动刷新版本。
Refreshing data…|正在刷新数据…
This shared map is read-only.|此共享地图为只读。
Unknown layer operation.|未知图层操作。
`.trim().split('\n').map(line=>{const i=line.indexOf('|');return [line.slice(0,i),line.slice(i+1)];})));
