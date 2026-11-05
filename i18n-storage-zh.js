/* Project and Results integration; user filenames and data values stay opaque. */
Object.assign(window.PortalTranslations['zh-CN'],Object.fromEntries(`
Files & device|文件与设备
Local files & cache|本地文件与缓存
Files, cache & local engine|文件、缓存与本地引擎
Save keeps a browser backup and also writes to Projects when a workspace folder is connected.|保存时保留浏览器备份；连接工作区文件夹后，还会将项目文件保存到 Projects。
Save project file to folder|将项目文件保存到文件夹
Saving project file to Projects folder…|正在将项目文件保存到 Projects 文件夹…
Project saved in this browser and Projects folder.|项目已保存至浏览器及 Projects 文件夹。
Project saved in this browser. Connect a workspace folder to save project files there too.|项目已保存至浏览器，连接工作区文件夹后可同时保存本地项目文件。
No workspace folder connected. Choose one in Files & device.|尚未连接工作区文件夹，请在“文件与设备”中选择。
Save data to Results|将数据保存到 Results
Save PNG to Results|将 PNG 保存到 Results
PNG saved to Results folder.|PNG 已保存至 Results 文件夹。
Only fixed analysis snapshots can be cached on disk.|仅可将固定分析快照缓存到磁盘。
This analysis snapshot exceeds the 64 MiB disk-cache file budget.|此分析快照超过单个磁盘缓存文件 64 MiB 的限制。
Choose a managed analysis snapshot.|请选择网站管理的分析快照。
This cache snapshot is too large.|此缓存快照过大。
This is not an analysis snapshot.|这不是分析快照。
`.trim().split('\n').map(row=>{const i=row.indexOf('|');return[row.slice(0,i),row.slice(i+1)];})));

Object.assign(window.PortalTranslations['zh-CN'], {
  'Verified provider metadata': '已验证的来源元数据',
  'Reusable provider data blocks': '可复用的来源数据块',
  'Verified provider cache hits': '已验证的来源缓存命中次数',
  'Source identities are checked before reuse. Changed sources invalidate cached metadata and data blocks.': '复用前检查来源身份；来源变化后，相关元数据和数据块缓存会失效。'
});
