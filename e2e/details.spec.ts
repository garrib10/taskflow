import { test, expect } from "@playwright/test";
import { currentBoardRaw, makeBoard, makeTask } from "../src/test/fixtures.ts";

test("read-first details, child management and guarded editing preserve saved work", async ({page}) => {
  const parent=makeTask({id:"detail-parent", title:"Release plan",description:"A deliberate release plan."});
  await page.goto("/");
  await page.evaluate(raw=>localStorage.setItem("taskflow-board",raw),currentBoardRaw(makeBoard([parent])));await page.reload();
  const opener=page.getByRole("button",{name:"Open task Release plan",exact:true});
  await opener.click();
  const detail=page.getByRole("dialog",{name:"Release plan",exact:true});
  await expect(detail.getByRole("heading",{name:"Release plan",exact:true})).toBeFocused();
  await expect(detail.getByRole("textbox")).toHaveCount(0);
  await detail.getByRole("button",{name:"Add SubTask to Release plan"}).click();
  const childForm=page.getByRole("dialog",{name:"Add SubTask",exact:true});
  await childForm.getByLabel("Title",{exact:true}).fill("Review release");
  await childForm.getByLabel("Description",{exact:true}).fill("Confirm release contents.");
  await childForm.getByRole("button",{name:"Create SubTask",exact:true}).click();
  await expect(detail).toContainText("0 of 1 subtasks complete");
  await expect(detail.getByRole("button",{name:"Add SubTask to Release plan"})).toBeFocused();
  await detail.getByRole("button",{name:"Open subtask Review release"}).click();
  const child=page.getByRole("dialog",{name:"Review release",exact:true});
  await child.getByRole("button",{name:"Manage parent of Review release"}).click();
  await page.getByLabel("Parent",{exact:true}).selectOption("");await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog",{name:"Discard Relationship Changes?"})).toBeVisible();
  await page.getByRole("button",{name:"Keep Editing",exact:true}).click();
  await page.getByRole("button",{name:"Save Relationship",exact:true}).click();
  await expect(child).toContainText("Independent task");
  await child.getByRole("button",{name:"Edit task",exact:true}).click();
  const editor=page.getByRole("dialog",{name:"Edit Task",exact:true});
  await editor.getByLabel("Title",{exact:true}).fill("");await editor.getByRole("button",{name:"Save Changes"}).click();
  await expect(editor.getByLabel("Title",{exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Keep Editing",exact:true}).click();
  await editor.getByLabel("Title",{exact:true}).fill("Reviewed release");await editor.getByRole("button",{name:"Save Changes"}).click();
  await page.reload();await expect(page.getByRole("button",{name:"Open task Reviewed release",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Open task Reviewed release",exact:true}).click();
  await page.getByRole("button",{name:"Delete Reviewed release",exact:true}).click();
  await page.getByRole("dialog",{name:"Delete Task",exact:true}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.getByRole("button",{name:"Delete Reviewed release",exact:true})).toBeFocused();
});

test("long details and all child rows stay reachable in drawers and short mobile sheets",async({page})=>{
  const title="Release plan "+"x".repeat(137);
  const parent=makeTask({id:"long-parent",title,description:"Description "+"y".repeat(288)});
  const children=Array.from({length:30},(_,i)=>makeTask({id:`long-child-${i}`,title:`Child ${i} `+"z".repeat(130),parentId:parent.id}));
  await page.goto("/");await page.evaluate(raw=>localStorage.setItem("taskflow-board",raw),currentBoardRaw(makeBoard([parent,...children])));await page.reload();
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[375,667],[320,568],[375,300],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.getByRole("button",{name:`Open task ${title}`,exact:true}).click();
    const detail=page.getByRole("dialog",{name:title,exact:true});
    await expect(detail.getByRole("listitem")).toHaveCount(30);
    await detail.getByRole("button",{name:`Open subtask ${children[29].title}`,exact:true}).scrollIntoViewIfNeeded();
    await expect(detail.getByRole("button",{name:`Open subtask ${children[29].title}`,exact:true})).toBeInViewport();
    await detail.getByRole("button",{name:"Edit task",exact:true}).click();
    const editor=page.getByRole("dialog",{name:"Edit Task",exact:true});
    await editor.getByRole("button",{name:"Save Changes",exact:true}).scrollIntoViewIfNeeded();
    await expect(editor.getByRole("button",{name:"Save Changes",exact:true})).toBeInViewport();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test("compact task creation keeps actions reachable and × protects an unfinished draft", async ({page})=>{
  await page.goto("/");
  for(const [width,height] of [[1440,900],[390,844],[320,568],[375,300]]) {
    await page.setViewportSize({width,height});
    await page.getByRole("button",{name:"+ Create Task",exact:true}).click();
    const composer=page.getByRole("dialog",{name:"Create New Task",exact:true});
    await expect(composer.getByLabel("Title",{exact:true})).toBeFocused();
    await expect(composer.getByRole("button",{name:"Create Task",exact:true})).toBeInViewport();
    await composer.getByLabel("Category",{exact:true}).selectOption("devops");
    await composer.getByRole("button",{name:"Close task creation",exact:true}).click();
    await expect(page.getByRole("dialog",{name:"Discard Changes?",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Keep Editing",exact:true}).click();
    await expect(composer.getByLabel("Category",{exact:true})).toHaveValue("devops");
    await composer.getByRole("button",{name:"Close task creation",exact:true}).click();
    await page.getByRole("button",{name:"Discard",exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test("stage selection lives in details, blocks incomplete parents and retains completed-child marks",async({page})=>{
  const parent=makeTask({id:"stage-parent",title:"Stage parent",status:"in-review"});
  const child=makeTask({id:"stage-child",title:"Stage child",parentId:parent.id});
  await page.goto("/");await page.evaluate(raw=>localStorage.setItem("taskflow-board",raw),currentBoardRaw(makeBoard([parent,child])));await page.reload();
  const stage=page.getByLabel("Workflow stage",{exact:true});if(await stage.count())await stage.selectOption("in-review");
  await page.getByRole("button",{name:"Open task Stage parent",exact:true}).click();
  await page.getByLabel("Stage",{exact:true}).selectOption("done");
  await expect(page.getByLabel("Stage",{exact:true})).toHaveValue("in-review");
  await expect(page.getByRole("dialog",{name:"Stage parent",exact:true})).toContainText("Finish these subtasks");
  await page.getByRole("button",{name:"Open subtask Stage child",exact:true}).click();
  for(const status of ["in-progress","in-review","done"])await page.getByLabel("Stage",{exact:true}).selectOption(status);
  await page.getByRole("button",{name:"Open parent Stage parent",exact:true}).click();
  await expect(page.getByRole("img",{name:"Completed subtask",exact:true})).toHaveClass(/is-complete/);
  await page.getByLabel("Stage",{exact:true}).selectOption("done");
  await expect(page.getByLabel("Stage",{exact:true})).toHaveValue("done");
  await page.getByRole("button",{name:"Close task details",exact:true}).click();
  await expect(page.locator(".task-movement-actions")).toHaveCount(0);
  await page.reload();if(await stage.count())await stage.selectOption("done");
  await expect(page.getByRole("button",{name:"Open task Stage child",exact:true}).locator(".completion-mark.is-complete")).toHaveCount(1);
});
