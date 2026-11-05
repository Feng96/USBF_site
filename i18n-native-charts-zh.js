/* Chart controls and execution messages only; original columns and values are opaque. */
(function(){
 const dictionary=window.PortalTranslations['zh-CN'];
 for(const line of `
Charts scan the complete local result or its exact selected records. Only chart summaries enter the browser.|图表统计完整本地结果或精确选择集，浏览器仅接收汇总结果。
Update the local engine to chart complete native results.|请更新本地引擎，以绘制完整结果的图表。
The native source changed. Reopen the complete result before charting.|本地来源已变化，请重新打开完整结果后作图。
The native source changed. Prepare the chart input again.|本地来源已变化，请重新准备图表输入。
The saved area count is calculated when preparing input.|准备输入时计算已保存区域内的记录数。
Complete local data · original values are retained|完整本地数据 · 保留原始值
Full input records|完整输入记录数
Data used|数据使用时间
Terms|使用条款
Provided values|已提供的值
Included values|纳入统计的值
Excluded or unavailable values|排除或不可用的值
Input quality|输入质量
Null values|Null 值
Non-numeric or non-finite values|非数值或非有限值
Excluded non-positive values|排除的小于或等于零的值
Use positive values only|仅使用大于零的值
Point plots need a bounded browser workset. Complete native results support distributions, category counts and grouped means.|点图需要已加载的浏览器分析数据集；完整本地结果支持分布、分类计数和分组均值。
Choose a distribution, category count or grouped mean chart for complete native results.|请为完整本地结果选择分布、分类计数或分组均值图表。
Choose between 2 and 30 chart groups.|请选择 2 至 30 个图表分组。
Choose between 2 and 30 category groups.|请选择 2 至 30 个分类分组。
Choose an original scalar field for this chart.|请为图表选择一个原始标量字段。
Choose an original category field.|请选择一个原始分类字段。
Choose an original scalar category field.|请选择一个原始标量分类字段。
Chart calculation cancelled.|图表计算已取消。
Choose an active chart request.|请选择正在运行的图表请求。
Choose a valid chart request identifier.|请选择有效的图表请求标识。
This chart request is already running.|此图表请求正在运行。
Unsupported chart options.|不支持这些图表选项。
The positive-value option must be true or false.|正值选项必须为 true 或 false。
Positive-only filtering applies to numerical charts.|正值筛选仅适用于数值图表。
Other categories|其他类别
Choose a supported operation for this workset.|请选择此分析数据集支持的操作。
Building matches|建筑匹配
View matching report|查看匹配报告
Download matching CSV|下载匹配 CSV
Download matching receipt|下载匹配记录
Match reports retain source identities and exact input scopes.|匹配报告保留来源标识与精确输入范围。
`.trim().split('\n')){const index=line.indexOf('|');if(index>0)dictionary[line.slice(0,index)]=line.slice(index+1);}
})();
