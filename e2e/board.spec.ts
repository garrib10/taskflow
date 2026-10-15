import { test, expect, type Page } from "@playwright/test";
import { representativeBoard } from "./boardFixtures.ts";
import { currentBoardRaw, makeBoard, makeTask } from "../src/test/fixtures.ts";
async function seed(page:Page, raw:string) {
  await page.goto("/");await page.evaluate(value=>localStorage.setItem("taskflow-board",value),raw);await page.reload();
  await expect(page.getByRole("heading",{name:"TaskFlow",exact:true})).toBeVisible();
}
test("compact workload remains readable across responsive stages, text scaling and reduced motion", async ({page})=>{
  await seed(page,currentBoardRaw(representativeBoard()));
  for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[390,844],[375,667],[360,800],[320,568],[375,300]]) {
    await page.setViewportSize({width,height});
    const stage=page.getByLabel("Workflow stage",{exact:true});
    if(width<=600) {
      await expect(stage).toBeVisible();await expect(page.locator(".column")).toHaveCount(1);
      for(const value of ["todo","in-progress","in-review","done"]) { await stage.selectOption(value);await expect(page.locator(".column h2")).toContainText(value); }
    } else await expect(page.locator(".column")).toHaveCount(4);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator(".task-card").first().getByRole("button",{name:/Open task/})).toBeVisible();
  expect(await page.locator(".task-card").first().evaluate(node=>getComputedStyle(node).transitionDuration)).toBe("0s");
});
test("explicit stage actions work without dragging and preserve focus and saved relationships",async({page})=>{
  const parent=makeTask({id:"parent",title:"Release parent"});const child=makeTask({id:"child",title:"Linked child",parentId:parent.id});
  await seed(page,currentBoardRaw(makeBoard([parent,child])));
  await page.getByRole("button",{name:"Open task Linked child",exact:true}).click();
  await page.getByRole("button",{name:"Edit task",exact:true}).click();
  await page.getByLabel("Stage",{exact:true}).selectOption("in-progress");
  await page.getByRole("button",{name:"Close task editor",exact:true}).click();
  await expect(page.getByRole("button",{name:"Open task Linked child",exact:true})).toBeFocused();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("taskflow-board")!).board);
  expect(saved.columns[1].tasks[0]).toMatchObject({id:"child",parentId:"parent",status:"in-progress"});
  const selector=page.getByLabel("Workflow stage",{exact:true});if(await selector.count()) await expect(selector).toHaveValue("in-progress");
});
test("pointer grip shows a valid overlay, applies manual gap placement and rejects reverse movement",async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  const incoming=makeTask({id:"incoming",title:"Incoming"});const first=makeTask({id:"first",title:"First",status:"in-progress"});const last=makeTask({id:"last",title:"Last",status:"in-progress"});
  await seed(page,currentBoardRaw(makeBoard([incoming,first,last])));
  await page.getByLabel("Ordering",{exact:true}).selectOption("manual");
  const grip=page.getByRole("group",{name:"Move task Incoming, todo",exact:true});
  const from=(await grip.boundingBox())!;
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+from.width/2+10,from.y+from.height/2);
  await expect(page.locator(".task-drag-overlay")).toContainText("Incoming");
  // The toolbar/drop feedback can start page autoscroll. Follow the live card gap
  // rather than a stale viewport coordinate while the page is still moving.
  await expect.poll(async () => {
    const target=(await page.locator("#task-first").boundingBox())!;
    await page.mouse.move(target.x+target.width/2,target.y+target.height-8,{steps:8});
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    return page.locator("#task-first").getAttribute("data-drop-position");
  }).toBe("after");
  await page.mouse.up();
  await expect(page.getByRole("region",{name:"in-progress (3)",exact:true}).getByRole("heading",{level:3})).toHaveText(["First","Incoming","Last"]);
  const saved=await page.evaluate(()=>localStorage.getItem("taskflow-board"));
  const movedGrip=page.getByRole("group",{name:"Move task Incoming, in-progress",exact:true});
  await movedGrip.focus();await page.keyboard.press("Space");await expect(movedGrip).toHaveAttribute("aria-pressed","true");
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status",{name:"Board updates"})).toContainText("Destination: Cannot move task from in-progress to todo");
  await page.keyboard.press("Space");
  await expect(page.getByRole("status",{name:"Board updates"})).toContainText("Cannot move task");
  expect(await page.evaluate(()=>localStorage.getItem("taskflow-board"))).toBe(saved);
});
test("touch hold uses the mobile destination tray and continues at the moved grip", async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await seed(page,currentBoardRaw(makeBoard([makeTask({id:"touch",title:"Touch work"})])));
  const session=await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled",{enabled:true});
  const grip=page.getByRole("group",{name:"Move task Touch work, todo",exact:true});
  await grip.scrollIntoViewIfNeeded();const from=(await grip.boundingBox())!;
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:from.x+from.width/2,y:from.y+from.height/2}]});
  // Wait for the configured deliberate hold to activate, rather than sleeping.
  await expect(grip).toHaveAttribute("aria-pressed","true");
  const destination=page.locator('[data-destination="in-progress"]');
  await expect(destination).toBeVisible();const target=(await destination.boundingBox())!;
  await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});
  await expect(destination).toHaveAttribute("data-over","true");
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(page.getByLabel("Workflow stage",{exact:true})).toHaveValue("in-progress");
  await expect(page.getByRole("group",{name:"Move task Touch work, in-progress",exact:true})).toBeFocused();
});
