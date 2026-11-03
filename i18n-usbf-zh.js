/* Interface strings for tiled display and explicit original-data reads. */
Object.assign(window.PortalTranslations['zh-CN'], Object.fromEntries(`
Building · tile preview|建筑 · 瓦片预览
Display preview · the outline may be clipped or simplified. Load the original building for its complete geometry and attributes.|显示预览 · 轮廓可能经过裁切或简化。加载原始建筑以获取完整几何与属性。
Load original building|加载原始建筑
Load original buildings for this area|加载此区域的原始建筑
Tile preview attributes|瓦片预览属性
Original building attributes|原始建筑属性
Building map · original data loads when needed|建筑地图 · 按需加载原始数据
Original building outlines · loaded area|原始建筑轮廓 · 已加载区域
Choose an area to load original buildings|选择区域以加载原始建筑
Buildings on the map|地图上的建筑
Original buildings load only when you analyze or download. Display tiles may be simplified or clipped.|仅在分析或下载时加载原始建筑。显示瓦片可能经过简化或裁切。
Loading original building…|正在加载原始建筑…
Loading original buildings…|正在加载原始建筑…
Loading original building data…|正在加载原始建筑数据…
Original building data could not load.|原始建筑数据加载失败。
Original data is taking too long. Choose a smaller area or try again.|原始数据加载超时。请选择更小的区域或重试。
Select a USBF building first.|请先选择 USBF 建筑。
This map record has no original-building location. Choose another building or download this map area.|此地图记录缺少原始建筑位置。请选择其他建筑，或下载此地图区域。
Zoom into a neighborhood or choose a smaller study area before loading original buildings.|加载原始建筑前，请放大至街区或选择更小的研究区域。
Choose a smaller area to load original buildings.|请选择更小的区域以加载原始建筑。
The map publication is unavailable. The last map is still shown.|地图发布暂不可用，仍显示上一次加载的地图。
Available outlines in this map area|此地图区域中的可用轮廓
Original data loads when you run an analysis or download.|运行分析或下载时才会加载原始数据。
This model keeps the area captured earlier. Choose Create model to use this map view.|此模型保留先前获取的区域。选择“创建模型”以使用当前地图视图。
Load original outlines|加载原始轮廓
Original records|原始记录
Display preview|显示预览
No original data loaded yet.|尚未加载原始数据。
Load an area to see original records.|加载区域以查看原始记录。
`.trim().split('\n').map(row => { const i = row.indexOf('|'); return [row.slice(0, i), row.slice(i + 1)]; })));
