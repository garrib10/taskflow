import { makeBoard, makeTask } from "../src/test/fixtures.ts";
import { taskStatuses } from "../src/domain/task/Task.ts";
/** Synthetic #97 workloads; never seed the owner's origin or production sample data. */
export function representativeBoard(total: 20 | 100 | 300 = 20) {
  const distribution = total === 20 ? [8,5,3,4] : total === 100 ? [45,25,15,15] : [135,75,45,45];
  const sizes = total === 20 ? [2,2,1] : total === 100 ? Array(10).fill(3) : [30,...Array(4).fill(5),...Array(10).fill(4)];
  const tasks = sizes.map((_,index)=>makeTask({id:`parent-${index}`,title:`Prepare release ${index + 1}`,status:"in-progress"}));
  let ordinal=tasks.length;
  sizes.forEach((size,parent)=> { for(let index=0;index<size;index++) tasks.push(makeTask({id:`record-${ordinal}`,title:`Review linked work ${ordinal}`,parentId:`parent-${parent}`,status:taskStatuses[(ordinal++ - sizes.length)%4]})); });
  distribution.forEach((count,stage)=> { while(tasks.filter(task=>task.status===taskStatuses[stage]).length<count) tasks.push(makeTask({id:`record-${ordinal}`,title:`Workflow task ${ordinal++}`,status:taskStatuses[stage]})); });
  const categories = ["feature","ui","bug","testing","refactor","devops"] as const;
  const priorities = ["high","medium","low"] as const;
  tasks.forEach((task,index)=> {
    const titleLength=total===20?[20,30,40][index%3]:total===100?[30,60,150][index%3]:[40,150][index%2];
    const descriptionLength=total===20?[60,90,120][index%3]:total===100?[80,160,300][index%3]:[80,300][index%2];
    task.title=(index%10===0?`Find-title ${index}`:task.title).padEnd(titleLength,index%10===9?"x":" · work").slice(0,titleLength);
    task.description=(index%10===1?"Find-description ":"Supporting notes ").padEnd(descriptionLength,"review ").slice(0,descriptionLength);
    task.priority=priorities[index%3];task.category=categories[index%6];task.createdAt=new Date(Date.UTC(2026,0,1)+index);
  });
  return makeBoard(tasks);
}
