import { useReducer } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { boardReducer } from '../../domain/board/boardReducer';
import { taskStatuses, type Task } from '../../domain/task/Task';
import { makeBoard, makeTask } from '../../test/fixtures';
import Board from './Board';
// Keep the real dnd-kit sensors; supply only the geometry jsdom cannot measure.
beforeEach(() => {
 vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
   const column=this.matches('.column')?this:this.closest<HTMLElement>('.column');
   const index=taskStatuses.findIndex(status=>column?.getAttribute('aria-labelledby')===`column-${status}-title`);
   if(this.matches('.column'))return new DOMRect(index*344,100,320,500);
   if(this.matches('.task-card'))return new DOMRect(index*344+16,150,280,180);
   return new DOMRect(0,0,1440,900);
 });
});
afterEach(()=>vi.restoreAllMocks());
function Harness({ tasks }: { tasks: Task[] }) { const [board,dispatch]=useReducer(boardReducer,makeBoard(tasks));return <Board board={board} dispatch={dispatch}/>; }
const task=makeTask({title:'Keyboard work'});
it('moves with the real keyboard sensor, retains one task, announces destination and restores focus', async () => {
 const user=userEvent.setup();render(<Harness tasks={[task]}/>);screen.getByRole('group',{name:'Move task Keyboard work, todo'}).focus();await user.keyboard(' ');await user.keyboard('{ArrowRight}');await user.keyboard(' ');
 await waitFor(()=>expect(within(screen.getByRole('region',{name:'in-progress (1)'})).getByRole('button',{name:'Open task Keyboard work'})).toHaveFocus());
 expect(screen.getAllByRole('button',{name:'Open task Keyboard work'})).toHaveLength(1);expect(screen.getByRole('status',{name:'Board updates'})).toHaveTextContent('Moved "Keyboard work" to in-progress.');
});
it('rejects a reverse keyboard transition without losing the task', async () => {
 const user=userEvent.setup();render(<Harness tasks={[{...task,status:'in-progress'}]}/>);screen.getByRole('group',{name:'Move task Keyboard work, in-progress'}).focus();await user.keyboard(' ');await user.keyboard('{ArrowLeft}');await user.keyboard(' ');
 await waitFor(()=>expect(screen.getByRole('status',{name:'Board updates'})).toHaveTextContent('Cannot move task from in-progress to todo.'));expect(screen.getByRole('region',{name:'in-progress (1)'})).toHaveTextContent('Keyboard work');expect(screen.getAllByRole('button',{name:'Open task Keyboard work'})).toHaveLength(1);
});
it('cancels keyboard movement with Escape and leaves useful focus', async () => {
 const user=userEvent.setup();render(<Harness tasks={[task]}/>);screen.getByRole('group',{name:'Move task Keyboard work, todo'}).focus();await user.keyboard(' ');await user.keyboard('{ArrowRight}');await user.keyboard('{Escape}');expect(screen.getByRole('region',{name:'todo (1)'})).toHaveTextContent('Keyboard work');expect(screen.getByRole('button',{name:'Open task Keyboard work'})).toHaveFocus();
});
