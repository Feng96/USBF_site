/* Basemap interface only; source names, file names and configuration values remain opaque. */
Object.assign(window.PortalTranslations['zh-CN'], Object.fromEntries(`
Basemaps|底图
REFERENCE MAP|参考底图
Close basemaps|关闭底图选项
Basemap options|底图选项
Reference maps|参考底图
Custom web tiles|自定义网络瓦片
Upload basemap|上传底图
Reference maps provide visual context. They do not change the analysis records.|参考底图提供显示背景，不改变分析记录。
Light canvas|浅色画布
Esri Light Gray Canvas · a quiet reference map|Esri Light Gray Canvas · 简洁的参考底图
Street names, places and local context|街道名称、地点与周边背景
Satellite imagery|卫星影像
Esri World Imagery · reference imagery only|Esri World Imagery · 仅作为参考影像
Dark canvas|深色画布
Esri Dark Gray Canvas · muted context for bright layers|Esri Dark Gray Canvas · 适合搭配明亮图层的深色背景
USGS The National Map · contours, roads and geographic context|USGS The National Map · 等高线、道路与地理背景
Terrain relief|地形晕渲
Esri World Terrain Base · shaded terrain, without building attributes|Esri World Terrain Base · 地形背景，不含建筑属性
Blank canvas|空白画布
No reference tiles · a white background for your own layers|无参考瓦片 · 使用白色背景显示用户图层
Use custom basemap|使用自定义底图
Connect a public raster tile service. The service must allow browser access.|连接公开的 Raster 瓦片服务；服务必须允许浏览器访问。
Basemap name|底图名称
HTTPS XYZ template|HTTPS XYZ 模板
Tile size|瓦片大小
Minimum zoom|最小缩放级别
Maximum zoom|最大缩放级别
Tile scheme|瓦片方案
Source attribution|来源署名
Apply custom tiles|应用自定义瓦片
Open a PNG, JPG or WebP image, or a USBF XYZ configuration JSON. Files stay in this browser.|打开 PNG、JPG、WebP 图像或 USBF XYZ 配置 JSON；文件保留在当前浏览器中。
Basemap file|底图文件
Image placement · EPSG:4326|图像放置范围 · EPSG:4326
Enter the image rectangle in longitude / latitude, or place it over the current map view. This stretches the image to that rectangle; it does not detect its location.|输入图像矩形范围的经纬度，或将图像放到当前地图范围。这会把图像铺到该矩形内，不会自动识别图像位置。
Place over current view|放到当前地图范围
Images: up to 16 MiB, 8,192 pixels per edge and 24 megapixels. This entry does not import vector MapLibre styles or GeoTIFF.|图像上限为 16 MiB、每边 8,192 像素及 24 百万像素。此入口不导入 Vector MapLibre 样式或 GeoTIFF。
Apply uploaded basemap|应用上传的底图
XYZ JSON example|XYZ JSON 示例
Custom basemaps reopen from Project files, not map links.|自定义底图通过 Project 文件重新打开，地图链接不包含自定义底图。
Preparing basemap…|正在准备底图…
Basemap applied. Your data layers are unchanged.|底图已应用，数据图层保持不变。
Enter a public HTTPS XYZ template with {z}, {x} and {y}.|请输入包含 {z}、{x} 和 {y} 的公开 HTTPS XYZ 模板。
Custom tiles need a public HTTPS address without embedded credentials or a fragment.|自定义瓦片需使用公开 HTTPS 地址，不能包含内嵌登录信息或 URL 片段。
Enter west, south, east and north in EPSG:4326.|请使用 EPSG:4326 输入西、南、东、北边界。
Image bounds need west < east and south < north inside the map latitude range.|图像边界需满足西小于东、南小于北，并位于地图支持的纬度范围内。
Choose a USBF XYZ configuration or a PNG, JPG or WebP image. General MapLibre styles are not supported here.|请选择 USBF XYZ 配置或 PNG、JPG、WebP 图像，此入口不支持通用 MapLibre 样式。
This custom basemap configuration contains unsupported fields.|此自定义底图配置含有不支持的字段。
Enter a basemap name.|请输入底图名称。
Keep source attribution within 4,000 characters.|来源署名请控制在 4,000 个字符以内。
Choose valid tile size, scheme and zoom levels from 0 to 22.|请选择有效的瓦片大小、方案，以及 0 到 22 之间的缩放级别。
Image bounds must use four EPSG:4326 corners.|图像边界必须使用四个 EPSG:4326 角点。
Image corners must describe a west/south/east/north rectangle.|图像角点必须构成由西、南、东、北边界定义的矩形。
Choose an undamaged PNG, JPG or WebP image.|请选择未损坏的 PNG、JPG 或 WebP 图像。
Use an image up to 8,192 pixels per edge and 24 megapixels.|请使用每边不超过 8,192 像素、总像素不超过 24 百万的图像。
This basemap is unavailable. Open its project file or choose another basemap.|此底图当前不可用，请打开对应的 Project 文件或选择其他底图。
Choose an image file up to 16 MiB.|请选择不超过 16 MiB 的图像文件。
This image exceeds the graphics texture size available on this device.|此图像超出了当前设备支持的图形纹理大小。
The image could not be decoded. Choose another image.|此图像无法解码，请选择其他图像。
Basemap change cancelled.|底图更改已取消。
Choose a basemap file first.|请先选择底图文件。
Keep the XYZ JSON configuration within 64 KiB.|XYZ JSON 配置请控制在 64 KiB 以内。
The XYZ configuration JSON is invalid.|XYZ 配置 JSON 无效。
Image configurations need their original image. Choose an image file instead.|图像配置需要原始图像文件，请选择对应图像。
West|西
East|东
`.trim().split('\n').map(row => { const at=row.indexOf('|'); return [row.slice(0,at),row.slice(at+1)]; })));
