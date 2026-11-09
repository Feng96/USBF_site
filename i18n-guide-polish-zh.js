/* Task preparation and portable progress: interface text only. */
(function(){
 const d=window.PortalTranslations['zh-CN'];
 for(const line of `
The saved task guide is invalid.|保存的任务引导信息无效。
Connect the local engine to package full result files.|连接本地引擎后，才能打包完整结果文件。
Connect local engine|连接本地引擎
Choose original records that support analysis.|选择支持分析的原始记录。
Choose analysis data|选择分析数据
Connect the workspace containing this full local result.|连接包含此完整本地结果的工作区。
Save one area to compare both sources.|保存同一个区域，用于比较两个来源。
Load two original polygon worksets for comparison.|加载两份原始 Polygon 分析数据，以便比较。
Add a second dataset|添加第二份数据
Load at least two original inputs to merge.|至少加载两份原始输入数据，再执行 Merge。
Import another file|导入另一个文件
Choose a complete polygon boundary layer with at most 100 zones.|选择完整的 Polygon 边界图层，每次最多使用 100 个分区。
Choose or import boundaries|选择或导入边界
Choose the original height field, or use another dataset.|选择原始高度字段，或使用另一份数据。
Choose height field|选择高度字段
Select records, or explicitly choose all workset records.|先选择记录，或明确改用分析数据集的全部记录。
Save a study area for the chosen record scope.|先保存研究区域，再使用此记录范围。
Complete these requirements|请先补齐这些条件
Ready for this step|此步骤所需条件已具备
Use existing data or choose an area|使用已有数据或选择区域
Save the Project to keep this task and its input choices. Reopening checks the data again before you continue.|保存 Project 可保留当前任务和输入选择。重新打开后会检查数据，再继续任务。
A Project saves map settings, task progress and available outcome snapshots. Downloaded files and external dependencies have their own locations.|Project 保存地图设置、任务进度和可用的成果快照。已下载文件和外部数据依赖各有存放位置。
Task restored. Review the checked inputs and saved outcomes before continuing.|任务已恢复。请检查输入条件和已保存成果，再继续操作。
The saved selection no longer matches this data. Select records again.|保存的选择集与当前数据不匹配，请重新选择记录。
The saved result does not match these records. Run the result step again.|保存的结果与这些记录不匹配，请重新执行结果步骤。
The restored input needs attention. Run the result step after fixing its requirements.|恢复的输入需要检查。请补齐条件后重新执行结果步骤。
Tasks & results|任务与成果
Checking the original local result file…|正在检查原始本地结果文件…
The original local result file is unavailable. Verify its dependency.|原始本地结果文件不可用，请检查数据依赖。
Verify dependencies|检查数据依赖
View saved outcome|查看已保存成果
Generate a result before reviewing this step.|请先生成结果，再进行检查。
Return to result step|返回执行步骤
Review the result before saving or finishing.|请先检查结果，再保存或完成任务。
Review result|检查结果
Show checked requirements|查看已具备的条件
Data coverage details|数据覆盖详情
`.trim().split('\n')){const i=line.indexOf('|');if(i>0)d[line.slice(0,i)]=line.slice(i+1);}
})();
