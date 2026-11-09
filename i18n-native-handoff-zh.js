/* Result handoff UI only. Dataset names, file paths and fields stay raw. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Add to analysis layers|加入可分析图层
Open analysis layer|打开分析图层
Adding to analysis layers…|正在加入可分析图层…
Added to analysis layers|已加入可分析图层
Local result file is ready|本地结果文件已就绪
Open the layer to continue with its attributes, selection and analysis.|打开图层后，可查看属性、选择记录并继续分析。
Task completion saves a local file. Add it to this Project to use it as analysis data.|任务完成后会保存本地文件。请将结果加入当前 Project，再作为分析数据使用。
0 records were returned. The analysis layer will be empty on the map.|结果为 0 条记录，加入后地图上不会显示建筑。
This result is partial. Only the returned records are available; resume failed parts in Task center.|这是部分结果，只包含已返回的记录；可在任务中心继续失败部分。
This task has no completed vector result to add.|此任务尚无可加入的矢量结果。
Refresh task details to read the result record count.|请刷新任务详情，以读取结果记录数。
This task is no longer available.|此任务已不可用。
The Project changed. Add this result again from its task.|Project 已切换，请从任务中重新加入此结果。
The local workspace changed. Reconnect this task workspace before adding its result.|本地工作区已切换，请连接此任务所属的工作区后再加入结果。
The task result changed. Refresh the task before adding it.|任务结果已变化，请刷新任务后再加入。
Empty result added to analysis layers. No buildings will be drawn.|空结果已加入可分析图层，地图上不会绘制建筑。
Result added to analysis layers. Open Attribute table to inspect full records.|结果已加入可分析图层，可打开属性表查看完整记录。
The analysis layer is added, but its map view could not be prepared. Open the attribute table or reconnect the engine.|分析图层已加入，但地图显示未准备成功。可先打开属性表，或重新连接本地引擎。
The map preview is unavailable. Full records are still available through the local engine.|地图预览暂不可用，仍可通过本地引擎读取完整记录。
The native result file is unavailable.|本地结果文件不可用。
Local result reference|本地结果
Open task details to add this local result.|请打开任务详情，将此本地结果加入图层。
Result layer tools are still loading.|结果图层工具仍在加载。
Refresh task details|刷新任务详情
This local result task is not available in the connected task history.|当前连接的任务历史中没有此本地结果任务。
Review and start the local task. When it finishes, choose Add to analysis layers in Task center or Tasks & results. The result file stays in your local Results folder.|检查并启动本地任务。完成后，在任务中心或“任务与成果”中点击“加入可分析图层”。结果文件保留在本地 Results 文件夹中。
Native plan ready. Start the task in Task center, then choose Add to analysis layers when it finishes.|本地任务计划已准备好。请在任务中心启动任务，完成后点击“加入可分析图层”。
`.trim().split('\n')){const at=row.indexOf('|');d[row.slice(0,at)]=row.slice(at+1);}})();
