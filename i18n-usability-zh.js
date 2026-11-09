/* Save destinations and local setup instructions; source fields remain opaque. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Saved in this browser and Projects folder|已保存在此浏览器和 Projects 文件夹
Browser project library|浏览器 Project 库
Project file sent to browser downloads|Project 文件已交给浏览器下载
Project saved to the workspace folder|Project 已保存到工作区文件夹
Project saved in this browser|Project 已保存在此浏览器
Last successful save or download|最近一次成功保存或下载
Included map layers|包含的地图图层
Saved task guides|保存的任务引导
Available result snapshots|可用的成果快照
Full native result files remain separate. Use a complete package to move them to another computer.|完整本地结果文件需另行保存。请使用完整数据包将它们转移到另一台电脑。
Map settings, input layers, guide progress and available result snapshots are included.|已包含地图设置、输入图层、引导进度和可用的成果快照。
Files already downloaded by your browser remain in its Downloads location. Saving a Project does not move those files.|浏览器已下载的文件仍保留在下载位置。保存 Project 不会移动这些文件。
Advanced source settings|高级来源设置
Moving to another computer|转移到另一台电脑
Saved results could not be restored. Review the input again.|未能恢复保存的成果，请重新检查输入。
Guide progress could not be restored. Review the input again.|未能恢复引导进度，请重新检查输入。
The task guide tools are still loading.|任务引导工具仍在加载中。
The result tools are still loading.|成果工具仍在加载中。
Return to current task|返回当前任务
Set up local processing|设置本地处理
Follow these steps once. The map stays in your browser; original-data tasks run in the desktop engine.|按这些步骤完成一次设置。地图在浏览器中显示，原始数据任务在桌面引擎中执行。
Check this computer|检查这台电脑
Download and install|下载并安装
Start USBF Engine|启动 USBF Engine
Pair this browser|配对此浏览器
Verify the workspace|核对工作区
The engine is connected. Verify the workspace parent before managing its local files.|引擎已连接。管理本地文件前，请先核对工作区的母文件夹。
USBF Engine is running. Enter its pairing code below.|USBF Engine 已启动，请在下方输入其显示的配对码。
Start the installed desktop program, then check the connection.|启动已安装的桌面程序，然后检查连接。
Installation has not been checked. The website can detect the engine when its desktop program responds.|尚未核实安装状态。桌面程序响应后，网站才能检测到引擎。
2 · Download and install|2 · 下载并安装
I already have USBF Engine|我已安装 USBF Engine
Download or reinstall|下载或重新安装
3 · Start the desktop program|3 · 启动桌面程序
Open USBF Engine on this computer. Keep its window open, then return to this page. The desktop window shows the address and pairing code.|在这台电脑上打开 USBF Engine，保持窗口开启后返回此页面。桌面窗口会显示地址和配对码。
4 · Pair this browser|4 · 配对此浏览器
Connection help|连接帮助
Local processing is ready|本地处理已就绪
Choose the same parent folder|选择相同的母文件夹
Choose the engine workspace parent in Local files, then verify it here.|在“本地文件”中选择引擎工作区的母文件夹，然后在此核对。
Advanced engine details and resources|高级引擎信息与资源设置
Start USBF Engine on this computer, then check the connection.|在这台电脑上启动 USBF Engine，然后检查连接。
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)dictionary[line.slice(0,i)]=line.slice(i+1);}
})();
