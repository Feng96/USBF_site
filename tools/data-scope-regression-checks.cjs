/* New data preparation plus the existing original-attribute table contract. */
module.exports=async qa=>{
 await require('./data-scope-workflow-checks.cjs')(qa);
 await qa.page.evaluate(()=>PortalDataWorkspace.hide());await qa.page.locator('#interface-language').selectOption('en');await qa.page.setViewportSize({width:1440,height:960});
 const table=await require('./inventory-table-workflow-checks.cjs').runInventoryTableWorkflowChecks(qa.page,qa.out);for(const message of table.checks)qa.ok(true,'Existing table: '+message);
 require('fs').writeFileSync(qa.out+'/scope-and-table-regression.json',JSON.stringify({passed:true,checks:qa.checks},null,2));
};
