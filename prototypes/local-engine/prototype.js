/* Interaction prototype only. No fetch, local service, storage or filesystem APIs. */
(function(){
'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang='en',tab='overview',timer=null,noticeTimer=null;
const dictionary=Object.fromEntries(`
Design preview|交互原型
All device details and actions are simulated. Nothing is installed, removed or read from your computer.|所有设备信息和操作均为模拟，不会安装、卸载或读取你的电脑。
Processing & device|计算与设备
Open map|打开地图
Language|语言
WORKSPACE SETTINGS|工作区设置
Overview|概览
Local engine|本地引擎
Storage|存储
Advanced|高级设置
Activity|活动记录
Reset preview|重置原型
Settings|设置
Skip to settings|跳至设置
The installed engine is stopped. Start it to reconnect.|已安装的引擎已停止，请启动后重新连接。
Not connected|未连接
Connected · simulated|已连接 · 模拟
Stopped · simulated|已停止 · 模拟
THIS COMPUTER|这台电脑
Processing location|计算位置
Choose where a task runs, and see where its data and results are stored.|选择任务在哪里运行，并查看数据来源和结果保存位置。
Simulation only|仅为模拟
Browser · active|浏览器 · 正在使用
Local engine · connected|本地引擎 · 已连接
Local engine · not connected|本地引擎 · 未连接
Cloud compute · not configured|云端计算 · 未配置
Where should the next task run?|下一个任务在哪里运行？
Both browser and local engine use this computer.|浏览器和本地引擎都使用这台电脑。
Browser|浏览器
Runs inside this tab.|在当前网页标签内运行。
Small jobs · no installation|小任务 · 无需安装
Runs in the USBF desktop app.|在 USBF 本地程序中运行。
Large jobs · app required|大任务 · 需安装本地程序
Cloud server|云端服务器
Runs on a remote machine.|在远程计算机运行。
Not available in this preview|此原型未提供
Data flow for this task|当前任务的数据流
Storage location is separate from computation.|存储位置与计算位置分别显示。
INPUT DATA|输入数据
COMPUTATION|执行计算
RESULTS|结果
Cloud storage → local download|云端存储 → 下载到本机
This computer · browser tab|这台电脑 · 浏览器标签
This computer · desktop app|这台电脑 · 本地程序
Browser session|浏览器会话
Export to keep the full result|导出后可保留完整结果
Local result folder|本地结果文件夹
Full data on disk; tiled map preview|完整数据保存在磁盘，地图使用瓦片预览
Local processing can still download source data. Cloud computing is off.|本地计算仍可能下载来源数据；云端计算未启用。
Example task|示例任务
Saved study area|已保存的研究区
Input rule|输入规则
Full original buildings intersecting the boundary|与边界相交的完整原始建筑
Requested records|请求记录数
Example count; not a live dataset query.|示例数量，并非真实数据查询。
Regional extract · 86,420 records|区域提取 · 86,420 条记录
Neighborhood extract · 1,200 records|街区提取 · 1,200 条记录
This example exceeds the browser budget. Connect the local engine to keep all requested records.|此示例超出浏览器预算，请连接本地引擎以处理全部请求记录。
No silent switch to a partial dataset or cloud execution.|不会静默改为部分数据或云端执行。
Run example task|运行示例任务
Prepare local engine|准备本地引擎
Cancel example|取消示例任务
Ready to start|可以开始
Running locally · simulated|本机处理中 · 模拟
Finished · simulated|已完成 · 模拟
Cancelled · simulated|已取消 · 模拟
Processing status|计算状态
No engine connection has been attempted. A website cannot reliably tell whether an unreachable app is uninstalled, stopped or blocked.|尚未尝试连接引擎。网页无法可靠区分无法连接的程序是未安装、未启动还是连接被阻止。
First time? Set up the app|首次使用？设置本地程序
Already installed? Connect|已经安装？连接
View engine details|查看引擎详情
Environment|运行环境
USBF managed · recommended|USBF 自带环境 · 推荐
Custom environment · advanced|自定义环境 · 高级
Result destination|结果位置
Local folder · no result upload|本地文件夹 · 不上传结果
No cloud worker is connected. Choosing a cloud data source does not enable cloud computation.|未连接云端计算服务。选择云端数据来源不会启用云端计算。
USBF Engine|USBF Engine
One app for larger jobs. Installation and removal use the operating system's confirmation flow.|通过一个本地程序处理大任务，安装和卸载由操作系统确认。
Connection|连接状态
Device information|设备信息
Information is available after the user connects the engine.|用户连接引擎后才显示设备信息。
Example device · not detected hardware|示例设备 · 并非实测硬件
Operating system|操作系统
App version|程序版本
Design build · simulated|设计版本 · 模拟
Processor capacity|CPU 容量
8 logical processors · example|8 个逻辑处理器 · 示例
Installed memory|内存总量
16 GiB · example|16 GiB · 示例
Active environment|当前环境
View component details|查看组件详情
Component builds will be pinned in a real release. This preview does not install GDAL, PROJ or DuckDB.|正式版本将固定组件构建版本；原型不会安装 GDAL、PROJ 或 DuckDB。
Bundled together · version shown in release|随程序打包 · 正式发布时显示版本
Only checks requested by the user|仅在用户主动操作时检查
Connect from an explicit click; approve the local-app pairing when requested.|通过点击发起连接，并在需要时确认与本地程序配对。
Choose your computer|选择电脑平台
Windows|Windows
macOS|macOS
Linux|Linux
Planned package|计划安装包
.exe / .msi installer|.exe / .msi 安装包
.dmg app installer|.dmg 应用安装包
.AppImage / .deb package|.AppImage / .deb 软件包
Set up local engine|设置本地引擎
Open installation preview|查看安装流程
Resources|资源设置
Limit how much the app may use. These controls use an example device.|设置本地程序可使用的资源；原型使用示例设备。
Custom limits|自定义限额
Balanced|均衡
Keep computer responsive|优先保持电脑流畅
Faster processing|优先处理速度
CPU threads|CPU 线程
Memory limit|内存上限
Cache limit|缓存上限
Used as a budget, not a performance guarantee.|这是资源预算，并非性能保证。
Suggest the local engine for large tasks|大任务时建议使用本地引擎
Never submit a cloud job automatically.|不会自动提交云端任务。
Start app when I sign in|登录电脑时启动本地程序
An explicit local setting; no hidden background service.|由用户明确设置，不创建隐藏的后台服务。
Update & maintenance|更新与维护
Updates are signed and installed after active jobs finish. Existing tasks retain their original runtime.|更新经过签名验证，并在当前任务结束后安装；已有任务继续使用原运行环境。
Preview update flow|预览更新流程
Repair managed runtime|修复自带运行环境
Stop engine|停止引擎
Start engine|启动引擎
Uninstall local engine|卸载本地引擎
Storage & results|存储与结果
Program files, temporary cache and your own results have different lifecycles.|程序文件、临时缓存和用户结果分别管理。
Program files|程序文件
Managed|由程序管理
Versioned runtime; replaced by a signed app update.|按版本保存运行环境，通过签名更新替换。
Source cache|来源缓存
Example usage|示例占用
Can be downloaded again. Active jobs pin their input files.|可以重新下载；运行中的任务会保留其正在使用的输入文件。
Clear cache|清理缓存
Projects & results|项目与结果
Preserved when the app is removed.|卸载本地程序时保留。
Change result folder|修改结果文件夹
App data layout|本地数据目录
Application runtime|程序运行环境
Cache & temporary files|缓存及临时文件
Job state & logs|任务状态与日志
User projects & outputs|用户项目与结果
Folders are examples for the selected platform. The real app will let the user choose data storage.|目录为所选平台的示例；正式程序允许用户选择数据存储位置。
Environment management|运行环境管理
Use a tested USBF bundle by default. Existing GIS installations remain separate.|默认使用经过测试的 USBF 环境，已有 GIS 软件保持独立。
Managed environment|自带独立环境
Recommended for everyday use. No Python or GIS setup needed.|推荐普通用户使用，无需自行配置 Python 或 GIS 环境。
Custom environment|自定义环境
For experienced users. Select and validate a complete environment.|面向有经验的用户，选择并验证一套完整环境。
Current selection|当前选择
Detected software is never selected automatically.|检测到的软件不会自动被选用。
Inspect existing environments|检测已有运行环境
Example findings only; the preview does not scan this device.|结果仅为示例，原型不会扫描设备。
Compatibility check|兼容性检查
A version number alone is not sufficient. Test drivers, spatial extensions and coordinate transformations.|仅查看版本号不够，还需验证格式驱动、空间扩展和坐标转换。
Existing QGIS environment · example conflict|已有 QGIS 环境 · 冲突示例
Validated custom environment · example compatible|自定义环境 · 兼容示例
Check compatibility|检查兼容性
Use selected environment|使用所选环境
No system packages are installed, upgraded or removed.|不安装、升级或移除系统中的软件包。
GDAL format drivers|GDAL 格式驱动
PROJ transformation test|PROJ 坐标转换测试
DuckDB spatial extension|DuckDB 空间扩展
Not checked|尚未检查
Passed · example|通过 · 示例
Driver missing · example|缺少驱动 · 示例
Keep the managed environment. The custom environment does not support every required operation.|请继续使用自带环境；这套自定义环境不支持全部所需操作。
Checks passed. You may explicitly use this environment for future tasks.|检查通过，可以明确选择此环境用于后续任务。
Custom runtimes run in separate worker processes. A task records the exact runtime that processed it.|自定义环境在独立工作进程中运行，任务记录实际使用的运行环境。
Activity & tasks|活动与任务
Each task states its execution location and runtime. This timeline is simulated.|每个任务标明执行位置和运行环境；此活动记录为模拟。
No simulated activity yet.|尚无模拟活动。
Close|关闭
Cancel|取消
Installation preview|安装流程预览
No installer has been released from this preview.|此原型尚未发布真实安装包。
Download the signed package for your platform.|下载所选平台的签名安装包。
Confirm installation in the operating system.|在操作系统中确认安装。
Launch USBF Engine and approve pairing with this website.|启动 USBF Engine，并确认与网站配对。
Simulate installation & connection|模拟安装并连接
Connect an existing engine|连接已有引擎
In the real app, this button requests access to the local companion program and asks for pairing. It does not scan the computer for installed packages.|正式程序会请求连接本地引擎并进行配对，不扫描电脑中的已安装软件包。
Simulate successful pairing|模拟配对成功
Cloud processing is not configured|尚未配置云端计算
The cloud card describes a separate future backend. Source Cooperative supplies input data; it is not a connected processing service.|云端卡片表示未来的独立计算服务；Source Cooperative 提供输入数据，当前并未连接云端计算服务。
Signed update preview|签名更新预览
Verify the release signature and compatibility.|验证发布签名与兼容性。
Wait for active jobs to finish; keep the old runtime available.|等待任务完成，并保留原运行环境。
Switch new tasks to the verified runtime; allow rollback if startup fails.|新任务切换到已验证环境，启动失败时可回退。
Only the USBF-managed runtime is repaired. Existing GIS environments and user results are preserved.|仅修复 USBF 自带运行环境，保留已有 GIS 环境和用户结果。
Simulate repair|模拟修复
Uninstall preview|卸载流程预览
The real app opens the operating system's uninstaller. This preview only changes simulated state.|正式程序将打开系统卸载器，原型仅改变模拟状态。
Remove USBF app and its managed runtime|移除 USBF 程序及其自带环境
Also clear re-downloadable source cache|同时清理可重新下载的来源缓存
Keep projects, results and external GDAL / DuckDB environments|保留项目、结果及外部 GDAL / DuckDB 环境
A task is running. Finish or cancel it before uninstalling.|任务正在运行，请等待完成或取消后再卸载。
Simulate uninstall · keep results|模拟卸载 · 保留结果
Change folder preview|修改目录预览
Enter an example path. This preview does not open or change folders.|输入示例路径，原型不会打开或修改文件夹。
Result folder|结果文件夹
Save example path|保存示例路径
Clear cache preview|清理缓存预览
Only inactive, re-downloadable cache is cleared. Project files and results are retained.|仅清理未被任务使用且可重新下载的缓存，保留项目和结果。
Simulate clear cache|模拟清理缓存
Simulation: engine connected with selected runtime.|模拟：已连接使用所选环境的本地引擎。
Simulation: local engine stopped.|模拟：本地引擎已停止。
Simulation: local engine started.|模拟：本地引擎已启动。
Simulation: managed runtime repaired.|模拟：自带运行环境已修复。
Simulation: app removed; projects and external software preserved.|模拟：程序已移除，项目和外部软件已保留。
Simulation: source cache cleared; results preserved.|模拟：来源缓存已清理，结果已保留。
Simulation: existing environments inspected; none selected automatically.|模拟：已检测已有环境，未自动选择任何环境。
Simulation: compatibility report created.|模拟：兼容性报告已生成。
Simulation: future jobs use the selected custom environment.|模拟：后续任务将使用所选自定义环境。
Simulation: managed environment selected.|模拟：已选择自带运行环境。
Simulation: result folder changed.|模拟：结果文件夹已修改。
Simulation: task started.|模拟：任务已开始。
Simulation: task finished with all requested records.|模拟：任务完成，包含全部请求记录。
Simulation: task cancelled.|模拟：任务已取消。
No files or native software were changed.|未修改任何文件或本地软件。
Simulation progress|模拟进度
Full result preserved|完整结果已保留
Task runtime|任务运行环境
Browser runtime|浏览器运行环境
All requested records · example|全部请求记录 · 示例
No active tasks|当前没有运行中的任务
Available after connection|连接后显示
` .trim().split('\n').map(row=>{const i=row.indexOf('|');return [row.slice(0,i),row.slice(i+1)];}));
function t(k,params={}){let s=lang==='zh-CN'?(dictionary[k]||k):k;return s.replace(/\{(\w+)\}/g,(m,key)=>params[key]??m);}
const icon=name=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"></use></svg>';
const button=(action,label,cls='',disabled=false)=>'<button data-action="'+action+'" class="'+cls+'" '+(disabled?'disabled':'')+'>'+t(label)+'</button>';
const s={installed:false,connected:false,stopped:false,mode:'browser',platform:'windows',environment:'managed',detected:false,checked:false,scenario:'conflict',cpu:4,memory:6,cacheLimit:20,cache:4.2,results:1.1,profile:'balanced',suggest:true,autostart:false,workload:'regional',customResult:null,job:null,events:[]};
const navigation=[['overview','Overview','sliders'],['engine','Local engine','computer'],['storage','Storage','folder'],['advanced','Advanced','shield'],['activity','Activity','history']];
function paths(){if(s.platform==='macos')return {app:'~/Library/Application Support/USBF/Engine/runtimes/<release>/',cache:'~/Library/Caches/USBF/',state:'~/Library/Application Support/USBF/state/',results:s.customResult||'~/Documents/USBF/Results/'};if(s.platform==='linux')return {app:'~/.local/share/USBF/Engine/runtimes/<release>/',cache:'~/.cache/USBF/',state:'~/.local/state/USBF/',results:s.customResult||'~/Documents/USBF/Results/'};return {app:'%LOCALAPPDATA%\\USBF\\Engine\\runtimes\\<release>\\',cache:'%LOCALAPPDATA%\\USBF\\Cache\\',state:'%LOCALAPPDATA%\\USBF\\State\\',results:s.customResult||'%USERPROFILE%\\Documents\\USBF\\Results\\'};}
function ready(){return s.connected&&!s.stopped;}
function status(){return ready()?'Connected · simulated':s.stopped?'Stopped · simulated':'Not connected';}
function count(){return s.workload==='regional'?86420:1200;}
function running(){return s.job?.status==='running';}
function heading(title,subtitle){return '<div class="page-heading"><div><p class="eyebrow">USBF / '+t('THIS COMPUTER')+'</p><h1>'+t(title)+'</h1><p class="subtitle">'+t(subtitle)+'</p></div><span class="chip amber">'+t('Simulation only')+'</span></div>';}
function row(label,value){return '<div class="detail-row"><span>'+t(label)+'</span><strong>'+value+'</strong></div>';}
function record(message,detail=''){s.events.unshift({time:new Date().toLocaleTimeString('en-GB'),message,detail});}
function notify(message){$('#notice').textContent=t(message);$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),4500);}
function overview(){
 const local=s.mode==='local',native=ready(),needsLocal=s.workload==='regional'&&!local;
 return heading('Processing location','Choose where a task runs, and see where its data and results are stored.')+
 '<div class="status-row"><span class="chip green">'+icon('browser')+t('Browser · active')+'</span><span class="chip '+(native?'green':'')+'">'+icon('computer')+t(native?'Local engine · connected':'Local engine · not connected')+'</span><span class="chip">'+icon('cloud')+t('Cloud compute · not configured')+'</span></div>'+
 '<div class="section-caption"><span>'+t('Where should the next task run?')+'</span><span>'+t('Both browser and local engine use this computer.')+'</span></div><div class="execution-grid">'+
 [['browser','Browser','Runs inside this tab.','Small jobs · no installation','browser'],['local','Local engine','Runs in the USBF desktop app.','Large jobs · app required','computer']].map(([value,label,note,tag,ico])=>'<label class="execution-card '+(s.mode===value?'selected':'')+'"><input type="radio" name="execution" value="'+value+'" '+(s.mode===value?'checked':'')+' '+(running()?'disabled':'')+'>'+icon(ico)+'<h3>'+t(label)+'</h3><p>'+t(note)+'</p><span class="card-tag">'+t(tag)+'</span></label>').join('')+
 '<div class="execution-card unavailable">'+icon('cloud')+'<h3>'+t('Cloud server')+'</h3><p>'+t('Runs on a remote machine.')+'</p><span class="card-tag">'+t('Not available in this preview')+'</span>'+button('cloud-info','Cloud compute · not configured','text-button')+'</div></div>'+
 '<div class="section-caption"><span>'+t('Data flow for this task')+'</span><span>'+t('Storage location is separate from computation.')+'</span></div><div class="columns"><div><section class="panel"><div class="dataflow"><div class="flow-step">'+icon('cloud')+'<small>'+t('INPUT DATA')+'</small><strong>Source Cooperative</strong><p>'+t('Cloud storage → local download')+'</p></div>'+icon('arrow').replace('class="icon"','class="icon flow-arrow"')+'<div class="flow-step compute">'+icon(local?'computer':'browser')+'<small>'+t('COMPUTATION')+'</small><strong>'+t(local?'USBF Engine':'Browser')+'</strong><p>'+t(local?'This computer · desktop app':'This computer · browser tab')+'</p></div>'+icon('arrow').replace('class="icon"','class="icon flow-arrow"')+'<div class="flow-step">'+icon('folder')+'<small>'+t('RESULTS')+'</small><strong>'+t(local?'Local result folder':'Browser session')+'</strong><p>'+t(local?'Full data on disk; tiled map preview':'Export to keep the full result')+'</p></div></div><p class="footnote">'+t('Local processing can still download source data. Cloud computing is off.')+'</p></section><section class="panel"><div class="panel-heading"><h2>'+t('Example task')+'</h2><span class="chip">Extract by mask</span></div><label class="field"><span>'+t('Requested records')+'</span><select id="workload" class="field-control" '+(running()?'disabled':'')+'><option value="regional" '+(s.workload==='regional'?'selected':'')+'>'+t('Regional extract · 86,420 records')+'</option><option value="small" '+(s.workload==='small'?'selected':'')+'>'+t('Neighborhood extract · 1,200 records')+'</option></select></label>'+row('Saved study area','Washington, DC · AOI 01')+row('Input rule',t('Full original buildings intersecting the boundary'))+'<p class="footnote">'+t('Example count; not a live dataset query.')+'</p>'+(needsLocal?'<div class="callout amber">'+t('This example exceeds the browser budget. Connect the local engine to keep all requested records.')+'<br>'+t('No silent switch to a partial dataset or cloud execution.')+'</div>':'')+jobMarkup()+'<div class="button-row">'+(needsLocal||local&&!native?button('prepare','Prepare local engine','primary',running()):button('run','Run example task','primary',running()))+(running()?button('cancel-job','Cancel example'):'')+'</div></section></div><div><section class="panel"><div class="panel-heading"><h2>'+t('Processing status')+'</h2>'+icon('shield')+'</div>'+(native?row('Connection',t(status()))+row('Environment',t(s.environment==='managed'?'USBF managed · recommended':'Custom environment · advanced'))+row('Result destination',t('Local folder · no result upload'))+'<div class="button-row">'+button('engine-tab','View engine details')+'</div>':s.installed&&s.stopped?'<p class="panel-description">'+t('The installed engine is stopped. Start it to reconnect.')+'</p><div class="button-row">'+button('start','Start engine','primary')+button('engine-tab','View engine details')+'</div>':'<p class="panel-description">'+t('No engine connection has been attempted. A website cannot reliably tell whether an unreachable app is uninstalled, stopped or blocked.')+'</p><div class="button-row">'+button('install','First time? Set up the app','primary')+button('connect','Already installed? Connect')+'</div>')+'</section><section class="panel planned"><h3>'+t('Cloud compute · not configured')+'</h3><p class="footnote">'+t('No cloud worker is connected. Choosing a cloud data source does not enable cloud computation.')+'</p></section></div></div>';
}
function jobMarkup(){const j=s.job;if(!j)return '<div class="job-status"><span>'+t('Ready to start')+'</span><span>'+count().toLocaleString('en-US')+'</span></div>';const label=j.status==='running'?'Running locally · simulated':j.status==='finished'?'Finished · simulated':'Cancelled · simulated';return '<div class="job-scope"><strong>'+t(label)+'</strong><br>'+t('Task runtime')+': '+t(j.mode==='browser'?'Browser runtime':j.environment==='managed'?'USBF managed · recommended':'Custom environment · advanced')+'</div><div class="progress" role="progressbar" aria-label="'+t('Simulation progress')+'" aria-valuenow="'+j.progress+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+j.progress+'%"></span></div><div class="job-status"><span>'+t(j.status==='finished'?'Full result preserved':'Simulation progress')+'</span><span>'+j.progress+'% · '+j.count.toLocaleString('en-US')+'</span></div>';}
function engine(){return heading('USBF Engine',"One app for larger jobs. Installation and removal use the operating system's confirmation flow.")+'<div class="columns"><div><section class="panel"><div class="panel-heading"><h2>'+t('Connection')+'</h2><span class="chip '+(ready()?'green':'')+'">'+t(status())+'</span></div><p class="panel-description">'+t('Connect from an explicit click; approve the local-app pairing when requested.')+'</p><div class="button-row">'+(ready()?button('stop','Stop engine','',running()):s.installed?button('start','Start engine','primary'):button('connect','Already installed? Connect','primary'))+(!s.installed?button('install','First time? Set up the app'):'')+'</div></section><section class="panel"><div class="panel-heading"><h2>'+t('Device information')+'</h2><span class="chip">'+t('Simulation only')+'</span></div>'+(ready()?'<p class="panel-description">'+t('Example device · not detected hardware')+'</p>'+row('Operating system',s.platform==='windows'?'Windows · x64':s.platform==='macos'?'macOS · Apple Silicon':'Linux · x64')+row('App version',t('Design build · simulated'))+row('Processor capacity',t('8 logical processors · example'))+row('Installed memory',t('16 GiB · example'))+row('Active environment',t(s.environment==='managed'?'USBF managed · recommended':'Custom environment · advanced')):'<div class="empty">'+t('Information is available after the user connects the engine.')+'</div>')+'<details><summary>'+t('View component details')+'</summary><p class="footnote">'+t('Component builds will be pinned in a real release. This preview does not install GDAL, PROJ or DuckDB.')+'</p>'+['GDAL / PROJ / GEOS','DuckDB + spatial'].map(v=>'<div class="detail-row"><span>'+v+'</span><strong>'+t(ready()?'Bundled together · version shown in release':'Available after connection')+'</strong></div>').join('')+'</details></section><section class="panel"><div class="panel-heading"><h2>'+t('Update & maintenance')+'</h2>'+icon('shield')+'</div><p class="panel-description">'+t('Updates are signed and installed after active jobs finish. Existing tasks retain their original runtime.')+'</p><div class="button-row">'+button('update','Preview update flow')+button('repair','Repair managed runtime','',!s.installed||running())+button('uninstall','Uninstall local engine','danger',!s.installed)+'</div></section></div><div><section class="panel"><h2>'+t('Resources')+'</h2><p class="panel-description">'+t('Limit how much the app may use. These controls use an example device.')+'</p><label class="field"><select id="profile" class="field-control"><option value="balanced" '+(s.profile==='balanced'?'selected':'')+'>'+t('Balanced')+'</option><option value="responsive" '+(s.profile==='responsive'?'selected':'')+'>'+t('Keep computer responsive')+'</option><option value="fast" '+(s.profile==='fast'?'selected':'')+'>'+t('Faster processing')+'</option><option value="custom" '+(s.profile==='custom'?'selected':'')+'>'+t('Custom limits')+'</option></select></label>'+slider('cpu','CPU threads',1,8,s.cpu,'')+slider('memory','Memory limit',2,12,s.memory,' GiB')+slider('cacheLimit','Cache limit',5,50,s.cacheLimit,' GiB')+'<p class="footnote">'+t('Used as a budget, not a performance guarantee.')+'</p><label class="toggle-row"><input id="suggest" type="checkbox" '+(s.suggest?'checked':'')+'><span>'+t('Suggest the local engine for large tasks')+'<small>'+t('Never submit a cloud job automatically.')+'</small></span></label><label class="toggle-row"><input id="autostart" type="checkbox" '+(s.autostart?'checked':'')+'><span>'+t('Start app when I sign in')+'<small>'+t('An explicit local setting; no hidden background service.')+'</small></span></label></section><section class="panel"><h3>'+t('Choose your computer')+'</h3>'+platformPicker()+'<p class="footnote">'+t('Planned package')+': '+t(s.platform==='windows'?'.exe / .msi installer':s.platform==='macos'?'.dmg app installer':'.AppImage / .deb package')+'</p></section></div></div>';}
function slider(key,label,min,max,value,unit){return '<label class="field"><span class="range-heading"><span>'+t(label)+'</span><output id="out-'+key+'">'+value+unit+'</output></span><input type="range" data-resource="'+key+'" aria-label="'+t(label)+'" min="'+min+'" max="'+max+'" value="'+value+'"></label>';}
function platformPicker(id='platform'){return '<select class="field-control" id="'+id+'" aria-label="'+t('Choose your computer')+'">'+['windows','macos','linux'].map(p=>'<option value="'+p+'" '+(s.platform===p?'selected':'')+'>'+({windows:'Windows',macos:'macOS',linux:'Linux'})[p]+'</option>').join('')+'</select>';}
function storage(){const p=paths();return heading('Storage & results','Program files, temporary cache and your own results have different lifecycles.')+'<div class="storage-grid"><section class="panel"><h2>'+t('Program files')+'</h2><div class="storage-number">'+t('Managed')+'</div><p class="footnote">'+t('Versioned runtime; replaced by a signed app update.')+'</p><div class="path">'+esc(p.app)+'</div>'+button('engine-tab','View engine details','text-button')+'</section><section class="panel"><h2>'+t('Source cache')+'</h2><div class="storage-number" data-cache-size>'+s.cache.toFixed(1)+' GiB</div><small class="muted">'+t('Example usage')+'</small><p class="footnote">'+t('Can be downloaded again. Active jobs pin their input files.')+'</p><div class="path">'+esc(p.cache)+'</div>'+button('clear-cache','Clear cache','',running())+'</section><section class="panel"><h2>'+t('Projects & results')+'</h2><div class="storage-number" data-result-size>'+s.results.toFixed(1)+' GiB</div><small class="muted">'+t('Example usage')+'</small><p class="footnote">'+t('Preserved when the app is removed.')+'</p><div class="path">'+esc(p.results)+'</div>'+button('result-folder','Change result folder')+'</section></div><section class="panel" style="margin-top:20px"><h2>'+t('App data layout')+'</h2>'+row('Application runtime',esc(p.app))+row('Cache & temporary files',esc(p.cache))+row('Job state & logs',esc(p.state))+row('User projects & outputs',esc(p.results))+'<p class="footnote">'+t('Folders are examples for the selected platform. The real app will let the user choose data storage.')+'</p></section>';}
function advanced(){return heading('Environment management','Use a tested USBF bundle by default. Existing GIS installations remain separate.')+'<section class="panel"><h2>'+t('Current selection')+'</h2><div class="env-options"><label class="env-option '+(s.environment==='managed'?'active':'')+'"><input name="environment" type="radio" value="managed" '+(s.environment==='managed'?'checked':'')+'><span><b>'+t('Managed environment')+'</b><small>'+t('Recommended for everyday use. No Python or GIS setup needed.')+'</small></span></label><div class="env-option '+(s.environment==='custom'?'active':'')+'"><span>'+icon('sliders')+'</span><span><b>'+t('Custom environment')+'</b><small>'+t('For experienced users. Select and validate a complete environment.')+'</small></span></div></div><p class="callout">'+t('Detected software is never selected automatically.')+'</p>'+button('detect','Inspect existing environments')+'<p class="footnote">'+t('Example findings only; the preview does not scan this device.')+'</p></section>'+(s.detected?'<section class="panel"><div class="panel-heading"><h2>'+t('Compatibility check')+'</h2><span class="chip">'+t('Simulation only')+'</span></div><p class="panel-description">'+t('A version number alone is not sufficient. Test drivers, spatial extensions and coordinate transformations.')+'</p><select class="field-control" id="scenario"><option value="conflict" '+(s.scenario==='conflict'?'selected':'')+'>'+t('Existing QGIS environment · example conflict')+'</option><option value="compatible" '+(s.scenario==='compatible'?'selected':'')+'>'+t('Validated custom environment · example compatible')+'</option></select><ul class="checks">'+['GDAL format drivers','PROJ transformation test','DuckDB spatial extension'].map((name,i)=>{const fail=s.checked&&s.scenario==='conflict'&&i===0;return '<li><b>'+t(name)+'</b><span class="'+(s.checked?fail?'fail':'pass':'')+'">'+t(!s.checked?'Not checked':fail?'Driver missing · example':'Passed · example')+'</span></li>';}).join('')+'</ul>'+(s.checked?'<p class="callout '+(s.scenario==='conflict'?'amber':'')+'">'+t(s.scenario==='conflict'?'Keep the managed environment. The custom environment does not support every required operation.':'Checks passed. You may explicitly use this environment for future tasks.')+'</p>':'')+'<div class="button-row">'+button('check-env','Check compatibility')+button('use-custom','Use selected environment','primary',!s.checked||s.scenario!=='compatible'||!s.installed)+'</div><p class="footnote">'+t('No system packages are installed, upgraded or removed.')+'</p></section>':'')+'<section class="panel"><h3>'+t('Task runtime')+'</h3><p class="footnote">'+t('Custom runtimes run in separate worker processes. A task records the exact runtime that processed it.')+'</p>'+row('Active environment',t(s.environment==='managed'?'USBF managed · recommended':'Custom environment · advanced'))+(s.job?row('Example task',t(s.job.environment==='managed'?'USBF managed · recommended':'Custom environment · advanced')):'')+'</section>';}
function activity(){return heading('Activity & tasks','Each task states its execution location and runtime. This timeline is simulated.')+'<section class="panel">'+(s.events.length?'<ul class="activity-list">'+s.events.map(e=>'<li><time>'+esc(e.time)+'</time><div><p>'+t(e.message)+'</p><small>'+esc(e.detail)+'</small></div></li>').join('')+'</ul>':'<div class="empty">'+t('No simulated activity yet.')+'</div>')+'</section>';}
function render(){document.documentElement.lang=lang;$('#navigation').setAttribute('aria-label',t('Settings'));$('#modal>header button').setAttribute('aria-label',t('Close'));document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));$('#navigation').innerHTML=navigation.map(([key,label,ico])=>'<button class="nav-item '+(tab===key?'active':'')+'" data-tab="'+key+'" '+(tab===key?'aria-current="page"':'')+'>'+icon(ico)+t(label)+'</button>').join('');$('#mini-status').innerHTML='<span class="dot '+(ready()?'ready':'')+'"></span><span>USBF Engine<br>'+t(status())+'</span>';$('#content').innerHTML=({overview,engine,storage,advanced,activity})[tab]();}
function modal(title,html){$('#modal').dataset.kind='';$('#modal-title').textContent=t(title);$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function close(){if($('#modal').open)$('#modal').close();}
function installation(){modal('Installation preview',platformPicker('installer-platform')+'<p class="callout amber">'+t('No installer has been released from this preview.')+'</p>'+['Download the signed package for your platform.','Confirm installation in the operating system.','Launch USBF Engine and approve pairing with this website.'].map((step,i)=>'<div class="step"><b>'+(i+1)+'</b><span>'+t(step)+'</span></div>').join('')+'<div class="button-row">'+button('simulate-install','Simulate installation & connection','primary')+button('close-dialog','Cancel')+'</div>');}
function uninstall(){modal('Uninstall preview','<p>'+t("The real app opens the operating system's uninstaller. This preview only changes simulated state.")+'</p><label class="toggle-row"><input type="checkbox" checked disabled><span>'+t('Remove USBF app and its managed runtime')+'</span></label><label class="toggle-row"><input id="remove-cache" type="checkbox"><span>'+t('Also clear re-downloadable source cache')+'</span></label><div class="callout">'+t('Keep projects, results and external GDAL / DuckDB environments')+'</div>'+(running()?'<div class="callout amber">'+t('A task is running. Finish or cancel it before uninstalling.')+'</div>':'')+'<div class="button-row">'+button('simulate-uninstall','Simulate uninstall · keep results','danger',running())+button('close-dialog','Cancel')+'</div>');$('#modal').dataset.kind='uninstall';}
function run(){if(running())return;if(s.mode==='local'&&!ready()||s.mode==='browser'&&s.workload==='regional'){installation();return;}s.job={mode:s.mode,environment:s.mode==='browser'?'browser':s.environment,status:'running',progress:0,count:count(),resources:{cpu:s.cpu,memory:s.memory}};record('Simulation: task started.',s.job.mode+' · '+s.job.count.toLocaleString('en-US')+' · '+s.job.environment);render();timer=setInterval(()=>{s.job.progress+=20;if(s.job.progress>=100){clearInterval(timer);timer=null;s.job.progress=100;s.job.status='finished';record('Simulation: task finished with all requested records.',s.job.mode+' · '+s.job.count.toLocaleString('en-US')+' · '+s.job.environment);if($('#modal').open&&$('#modal').dataset.kind==='uninstall'){const value=$('#remove-cache').checked;uninstall();$('#remove-cache').checked=value;}}if(tab==='overview'||s.job.status==='finished')render();},900);}
function action(name){
 if(name==='close-dialog'){close();return;}
 if(name==='reset'){clearInterval(timer);timer=null;location.reload();return;}
 if(name==='install'){installation();return;}
 if(name==='connect'||name==='prepare'){if(name==='prepare'&&!s.installed){installation();return;}modal('Connect an existing engine','<p>'+t('In the real app, this button requests access to the local companion program and asks for pairing. It does not scan the computer for installed packages.')+'</p><div class="button-row">'+button('simulate-install','Simulate successful pairing','primary')+button('close-dialog','Cancel')+'</div>');return;}
 if(name==='simulate-install'){const fresh=!s.installed;s.installed=true;s.connected=true;s.stopped=false;if(fresh)s.environment='managed';close();record('Simulation: engine connected with selected runtime.',s.environment);notify('Simulation: engine connected with selected runtime.');render();return;}
 if(name==='engine-tab'){tab='engine';render();return;}
 if(name==='cloud-info'){modal('Cloud processing is not configured','<p>'+t('The cloud card describes a separate future backend. Source Cooperative supplies input data; it is not a connected processing service.')+'</p>'+button('close-dialog','Close'));return;}
 if(name==='run'){run();return;}
 if(name==='cancel-job'){if(running()){clearInterval(timer);timer=null;s.job.status='cancelled';record('Simulation: task cancelled.');render();}return;}
 if(name==='stop'){if(running())return;s.connected=false;s.stopped=true;record('Simulation: local engine stopped.');notify('Simulation: local engine stopped.');render();return;}
 if(name==='start'){s.installed=true;s.connected=true;s.stopped=false;record('Simulation: local engine started.');notify('Simulation: local engine started.');render();return;}
 if(name==='update'){modal('Signed update preview',['Verify the release signature and compatibility.','Wait for active jobs to finish; keep the old runtime available.','Switch new tasks to the verified runtime; allow rollback if startup fails.'].map((v,i)=>'<div class="step"><b>'+(i+1)+'</b><span>'+t(v)+'</span></div>').join('')+'<p class="callout amber">'+t('No installer has been released from this preview.')+'</p>'+button('close-dialog','Close'));return;}
 if(name==='repair'){modal('Repair managed runtime','<p>'+t('Only the USBF-managed runtime is repaired. Existing GIS environments and user results are preserved.')+'</p><div class="button-row">'+button('simulate-repair','Simulate repair','primary',running())+button('close-dialog','Cancel')+'</div>');return;}
 if(name==='simulate-repair'){if(running())return;s.environment='managed';close();record('Simulation: managed runtime repaired.');notify('Simulation: managed runtime repaired.');render();return;}
 if(name==='uninstall'){uninstall();return;}
 if(name==='simulate-uninstall'){if(running())return;const clear=$('#remove-cache').checked;if(clear)s.cache=0;s.installed=false;s.connected=false;s.stopped=false;s.environment='managed';close();record('Simulation: app removed; projects and external software preserved.');notify('Simulation: app removed; projects and external software preserved.');render();return;}
 if(name==='clear-cache'){modal('Clear cache preview','<p>'+t('Only inactive, re-downloadable cache is cleared. Project files and results are retained.')+'</p><div class="button-row">'+button('simulate-clear','Simulate clear cache','primary',running())+button('close-dialog','Cancel')+'</div>');return;}
 if(name==='simulate-clear'){if(running())return;s.cache=0;close();record('Simulation: source cache cleared; results preserved.');notify('Simulation: source cache cleared; results preserved.');render();return;}
 if(name==='result-folder'){modal('Change folder preview','<p>'+t('Enter an example path. This preview does not open or change folders.')+'</p><label class="field"><span>'+t('Result folder')+'</span><input id="example-path" type="text" maxlength="400" value="'+esc(paths().results)+'"></label><div class="button-row">'+button('save-path','Save example path','primary')+button('close-dialog','Cancel')+'</div>');return;}
 if(name==='save-path'){s.customResult=$('#example-path').value.trim()||null;close();record('Simulation: result folder changed.');render();return;}
 if(name==='detect'){s.detected=true;s.checked=false;record('Simulation: existing environments inspected; none selected automatically.');notify('Simulation: existing environments inspected; none selected automatically.');render();return;}
 if(name==='check-env'){s.checked=true;record('Simulation: compatibility report created.',s.scenario);render();return;}
 if(name==='use-custom'){if(!s.checked||s.scenario!=='compatible'||!s.installed)return;s.environment='custom';record('Simulation: future jobs use the selected custom environment.');notify('Simulation: future jobs use the selected custom environment.');render();return;}
}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action],[data-tab]');if(!b||b.disabled)return;if(b.dataset.tab){tab=b.dataset.tab;render();window.scrollTo(0,0);return;}if(b.dataset.action)action(b.dataset.action);});
 document.addEventListener('change',e=>{const el=e.target;if(el.id==='language'){lang=el.value;close();clearTimeout(noticeTimer);$('#notice').classList.remove('visible');render();}if(el.name==='execution'){if(running())return;s.mode=el.value;render();}if(el.id==='workload'){s.workload=el.value;s.job=null;render();}if(el.id==='platform'||el.id==='installer-platform'){s.platform=el.value;s.customResult=null;render();}if(el.id==='profile'){s.profile=el.value;if(s.profile!=='custom')[s.cpu,s.memory]=s.profile==='responsive'?[2,3]:s.profile==='fast'?[8,10]:[4,6];render();}if(el.id==='suggest')s.suggest=el.checked;if(el.id==='autostart')s.autostart=el.checked;if(el.id==='scenario'){s.scenario=el.value;s.checked=false;render();}if(el.name==='environment'&&el.value==='managed'){s.environment='managed';record('Simulation: managed environment selected.');render();}});
 document.addEventListener('input',e=>{const key=e.target.dataset.resource;if(!key)return;s[key]=Number(e.target.value);if(key==='cpu'||key==='memory'){s.profile='custom';if($('#profile'))$('#profile').value='custom';}$('#out-'+key).textContent=s[key]+(key==='cpu'?'':' GiB');});
 window.EngineDesign={getState:()=>JSON.parse(JSON.stringify(s)),get tab(){return tab;}};render();
})();
