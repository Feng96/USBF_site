/* Translate controls and system messages; original fields and source IDs stay opaque. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
This display has no matching original-data release. Reopen it from Add Data.|此显示连接没有匹配的原始数据版本，请从 Add Data 重新打开。
Update the local engine to load original records from this provider.|请更新本地引擎，以加载此来源的原始记录。
This source requires the local engine on a desktop computer.|此数据来源需要在桌面电脑上使用本地引擎。
Original-data source|原始数据来源
Original-data release|原始数据版本
Native original-data reader|本地原始数据读取器
Provider adapter unavailable|尚未接入此来源的读取器
One saved area and one record scope apply to every source.|所有来源使用同一研究区域和记录范围。
Local task planning reads source metadata before execution.|本地任务会在执行前读取来源元数据以生成计划。
`.trim().split('\n')){const index=line.indexOf('|');if(index>0)dictionary[line.slice(0,index)]=line.slice(index+1);}
})();
