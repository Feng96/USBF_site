/* UI guidance only. Raw dataset names, field names and values remain unchanged. */
(function(){const d=window.PortalTranslations['zh-CN'];for(const row of `
Map style & display filters|地图样式与显示过滤
Display filters|显示过滤
Display source|显示来源
Display minimum area · m²|显示最小面积 · m²
Display filters change the map only. They do not select records or change the analysis scope.|显示过滤只改变地图画面，不会选择记录或改变分析范围。
Tile attribute preview|瓦片属性预览
Preview attributes|预览属性
Boundary attribute table|边界属性表
Live preview attributes follow the map. Prepare a fixed analysis workset to select or analyze records.|实时预览属性随地图变化。请先准备固定的分析数据集，再选择或分析记录。
Bounded display preview only. Full native records are a separate local dependency.|这里只显示有限的预览记录，完整原始记录保存在独立的本地文件中。
Tile attributes describe display fragments, not complete buildings. Prepare original records for selection and analysis.|瓦片属性对应显示片段，不代表完整建筑。请准备原始记录后再进行选择和分析。
Search preview attributes…|搜索预览属性…
Search preview attributes|搜索预览属性
Search table records…|搜索表格记录…
Search table records|搜索表格记录
LIVE PREVIEW|实时预览
Live map preview · not a fixed analysis workset|实时地图预览 · 尚非固定分析数据集
Download preview CSV|下载预览 CSV
Download table CSV|下载表格 CSV
Export preview attributes|导出预览属性
Preview CSV contains attributes from the current preview, including hidden fields, with its source and display scope. Prepare original records for analytical data exports.|预览 CSV 包含当前预览的属性（包括隐藏字段）及其来源和显示范围。分析数据导出需要先准备原始记录。
Exports contain visible, filtered original records.|导出包含当前可见、经过显示过滤的原始记录。
Prepare original records before exporting analytical geometry. Preview tables provide attribute CSV only.|请先准备原始记录再导出分析几何。预览表仅提供属性 CSV。
`.trim().split('\n')){const at=row.indexOf('|');d[row.slice(0,at)]=row.slice(at+1);}})();
