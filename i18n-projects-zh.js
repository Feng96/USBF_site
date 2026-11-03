/* Project interface copy; project names, source records and document values stay opaque. */
Object.assign(window.PortalTranslations['zh-CN'], Object.fromEntries(`
Projects|项目
Choose a USBF map file saved by this website.|请选择由本网站保存的 USBF 地图文件。
This file is not a valid USBF map. Choose a .usbf.json file.|此文件不是有效的 USBF 地图，请选择 .usbf.json 文件。
This map file has an invalid map position or coordinate system.|此地图文件的位置或坐标系无效。
This map file contains too many layers or files.|此地图文件包含过多图层或文件。
A file stored in this map is invalid or too large.|地图中的文件无效或过大。
The files stored in this map exceed 48 MB.|此地图内保存的文件超过 48 MB。
A stored file has invalid base64 padding.|保存文件的 base64 padding 无效。
A saved layer is missing its original file.|保存的图层缺少原始文件。
A saved layer is invalid.|保存的图层无效。
A saved layer has invalid source details.|保存的图层来源信息无效。
A saved catalog source is invalid.|保存的目录数据源无效。
A saved vector layer is invalid.|保存的 Vector 图层无效。
A saved raster is missing its source.|保存的 Raster 缺少来源。
A saved raster has an invalid read area.|保存的 Raster 读取区域无效。
A saved image preview has invalid map corners.|保存影像预览的地图角点无效。
A saved connection is invalid.|保存的连接无效。
This map uses a layer type that cannot be opened here.|此地图使用了无法在此打开的图层类型。
The saved layer order is invalid.|保存的图层顺序无效。
The saved active layer is missing.|保存的当前图层不存在。
A saved model is missing its original geometry or location.|保存的模型缺少原始 Geometry 或位置。
The saved research model is invalid.|保存的研究模型无效。
Current project|当前项目
Project name|项目名称
Save project|保存项目
Save a copy|保存副本
Export for sharing|导出以分享
Open project file|打开项目文件
Saved projects in this browser|此浏览器中保存的项目
No saved projects yet. Save your first project above.|尚无已保存项目。请在上方保存第一个项目。
New project|新建项目
Clear cache|清理缓存
Open|打开
Export file|导出文件
Delete|删除
Refresh|刷新
Working…|正在处理…
Unsaved changes|有未保存的修改
Saved in this browser|已保存在此浏览器
Not saved yet|尚未保存
Projects are saved in this browser. Export a project file to back up your work or send it to a teammate.|项目保存在此浏览器中。导出项目文件以备份工作或发送给队友。
Team cloud sync is not connected. Opening a shared file creates a separate project copy.|尚未连接团队云端同步。打开分享文件将创建独立的项目副本。
Layers, styles, view, drawings, models and map layout are included. Online sources reconnect to their latest publication.|包含图层、样式、视角、绘图、模型及地图版式。在线数据源将重新连接至最新发布版本。
Clear cache keeps your current work and saved projects. New project starts with an empty map.|清理缓存会保留当前工作及已保存项目。新建项目将从空白地图开始。
Saving project…|正在保存项目…
Project saved in this browser. Export a file to share it or keep a backup.|项目已保存在此浏览器中。请导出文件以分享或备份。
Preparing project file…|正在准备项目文件…
Project file downloaded. Send it to a teammate to open the same map.|项目文件已下载。发送给队友即可打开相同的地图配置。
Unsaved project changes|项目有未保存的修改
Save your current project before replacing this map?|替换当前地图前，是否保存当前项目？
Save and continue|保存并继续
Discard changes|放弃修改
Project opened. Online sources reconnect to their latest publication.|项目已打开。在线数据源将重新连接至最新发布版本。
Project file opened as a separate copy. Save it to keep it in this browser.|项目文件已作为独立副本打开。请保存以将其保留在此浏览器中。
New blank project ready. Your saved projects are kept.|空白项目已就绪。已保存的项目已保留。
Temporary map cache cleared. Current work and saved projects are kept.|临时地图缓存已清理。当前工作及已保存项目已保留。
Cache cleared · current view kept|缓存已清理 · 保留当前视图
Cache cleared · move the map to reload|缓存已清理 · 移动地图以重新加载
Delete saved project?|删除已保存项目？
This removes the saved copy from this browser. The open map and downloaded files are kept.|此操作将删除浏览器中的已保存副本。当前打开的地图及已下载文件会保留。
Delete saved copy|删除已保存副本
Saved copy deleted.|已保存副本已删除。
Project storage is unavailable. Export a project file to keep your work.|项目存储不可用。请导出项目文件以保留工作。
Close other USBF tabs and try opening the project library again.|请关闭其他 USBF 标签页后重新打开项目列表。
The project library could not be read.|无法读取项目列表。
This saved project no longer exists.|此已保存项目已不存在。
The saved project could not be read.|无法读取已保存项目。
This project changed in another tab. Reopen it or save a copy.|此项目已在其他标签页中更改。请重新打开或保存副本。
This project is invalid or too large to save.|此项目无效或过大，无法保存。
Browser storage is full. Export a project file or delete an older saved project.|浏览器存储空间已满。请导出项目文件或删除较早的已保存项目。
The project could not be saved.|项目保存失败。
The saved project could not be deleted.|已保存项目删除失败。
The project identity or revision is invalid.|项目身份或修订号无效。
The project source revision is invalid.|项目来源修订号无效。
The project map layout is invalid.|项目地图版式无效。
`.trim().split('\n').map(row => { const i = row.indexOf('|'); return [row.slice(0, i), row.slice(i + 1)]; })));
