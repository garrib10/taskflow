import { useReducer } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import { boardReducer } from '../../domain/board/boardReducer';
import { makeBoard, makeTask } from '../../test/fixtures';
import Board from './Board';
const drag = vi.hoisted((): { end?: (event: DragEndEvent) => void } => ({}));
vi.mock('@dnd-kit/core', async original => ({ ...await original<typeof import('@dnd-kit/core')>(), DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (event: DragEndEvent) => void }) => { drag.end = onDragEnd; return children; } }));
const parent = makeTask({ id: 'parent', title: 'Parent work', priority: 'high' });
const child = makeTask({ id: 'child', title: 'Child work', parentId: parent.id });
function Harness({ tasks = [parent, child] }: { tasks?: ReturnType<typeof makeTask>[] }) { const [board, dispatch] = useReducer(boardReducer, makeBoard(tasks)); return <Board board={board} dispatch={dispatch} />; }
const updates = () => screen.getByRole('status', { name: 'Board updates' });
it('exposes required fields, counts and field errors; repeat failures still focus the first invalid field', async () => {
 const user=userEvent.setup();render(<Harness />);await user.click(screen.getByRole('button',{name:'+ Create Task'}));
 const form=within(screen.getByRole('dialog',{name:'Create New Task'}));const title=form.getByLabelText('Title'),description=form.getByLabelText('Description');
 expect(title).toHaveFocus();expect(title).toBeRequired();expect(description).toBeRequired();expect(title).toHaveAccessibleDescription('0/150');
 await user.click(form.getByRole('button',{name:'Create Task'}));expect(title).toHaveAttribute('aria-invalid','true');expect(title).toHaveFocus();expect(title).toHaveAccessibleDescription('0/150 Task title is required.');
 await user.click(form.getByRole('button',{name:'Create Task'}));expect(title).toHaveFocus();
 await user.type(title,'x');await user.click(form.getByRole('button',{name:'Create Task'}));expect(title).toHaveAccessibleDescription('1/150 Task title must be at least 3 characters long.');
 await user.clear(title);await user.type(title,'New task');await user.click(form.getByRole('button',{name:'Create Task'}));expect(description).toHaveFocus();expect(description).toHaveAttribute('aria-invalid','true');expect(description).toHaveAccessibleDescription('0/300 Task description is required.');
 await user.type(description,'A description');await user.click(form.getByRole('button',{name:'Create Task'}));expect(screen.getByRole('button',{name:'Open task New task'})).toHaveFocus();expect(updates()).toHaveTextContent('Created "New task".');
});
it('restores edited-task focus and keeps names contextual', async () => {
 const user=userEvent.setup();render(<Harness />);const edit=screen.getByRole('button',{name:'Edit Child work'});await user.click(edit);
 await user.type(screen.getByLabelText('Description'),' edited');await user.click(screen.getByRole('button',{name:'Save Changes'}));expect(screen.getByRole('button',{name:'Open task Child work'})).toHaveFocus();expect(updates()).toHaveTextContent('Updated "Child work".');
 await user.click(edit);await user.keyboard('{Escape}');expect(edit).toHaveFocus();expect(screen.getByRole('button',{name:'Delete Parent work'})).toBeInTheDocument();
});
it('contains unsaved confirmation focus and restores the form before restoring its original opener', async () => {
 const user=userEvent.setup();render(<Harness />);const opener=screen.getByRole('button',{name:'Edit Parent work'});await user.click(opener);await user.type(screen.getByLabelText('Title'),' draft');await user.keyboard('{Escape}');
 const dialog=within(screen.getByRole('dialog',{name:'Discard Changes?'}));expect(dialog.getByRole('button',{name:'Keep Editing'})).toHaveFocus();await user.tab({shift:true});expect(dialog.getByRole('button',{name:'Discard'})).toHaveFocus();
 await user.keyboard('{Escape}');expect(screen.getByRole('dialog',{name:'Edit Task'})).toContainElement(document.activeElement as HTMLElement);expect(screen.getByLabelText('Title')).toHaveValue('Parent work draft');
 await user.keyboard('{Escape}');await user.click(screen.getByRole('button',{name:'Discard'}));expect(opener).toHaveFocus();
});
it('uses unique nested field IDs and returns child actions to useful parent controls', async () => {
 const user=userEvent.setup();render(<Harness />);await user.click(screen.getByRole('button',{name:'Edit Parent work'}));const add=screen.getByRole('button',{name:'Add SubTask to Parent work'});await user.click(add);
 const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
 const creator=within(screen.getByRole('dialog',{name:'Add SubTask'}));await user.type(creator.getByLabelText('Title'),'New child');await user.type(creator.getByLabelText('Description'),'Child description');await user.click(screen.getByRole('button',{name:'Create SubTask'}));expect(add).toHaveFocus();expect(updates()).toHaveTextContent('Created subtask "New child" for "Parent work".');
 const title=screen.getByRole('button',{name:'Open subtask Child work'});await user.click(title);await user.type(within(screen.getByRole('dialog',{name:'Edit SubTask'})).getByLabelText('Description'),' updated');await user.click(screen.getByRole('button',{name:'Save Changes'}));expect(title).toHaveFocus();
});
it('contains relationship focus and restores its manage-parent trigger', async () => {
 const user=userEvent.setup();render(<Harness />);await user.click(screen.getByRole('button',{name:'Edit Child work'}));const manage=screen.getByRole('button',{name:'Manage parent of Child work'});await user.click(manage);
 const dialog=screen.getByRole('dialog',{name:'Manage Parent'});expect(within(dialog).getByLabelText('Parent')).toHaveFocus();expect(dialog).toHaveAccessibleDescription(/Detaching keeps/);await user.keyboard('{Escape}');expect(manage).toHaveFocus();
});
it('returns deletion cancellation to its opener and deletion to a surviving task', async () => {
 const user=userEvent.setup();render(<Harness />);const remove=screen.getByRole('button',{name:'Delete Parent work'});await user.click(remove);await user.keyboard('{Escape}');expect(remove).toHaveFocus();
 await user.click(remove);await user.click(screen.getByRole('button',{name:'Delete Parent and Detach Subtasks'}));expect(screen.getByRole('button',{name:'Open task Child work'})).toHaveFocus();expect(updates()).toHaveTextContent('Deleted parent "Parent work"; subtasks kept');
});
it('focuses the column heading after deleting its last task', async () => {
 const user=userEvent.setup();render(<Harness tasks={[parent]} />);await user.click(screen.getByRole('button',{name:'Delete Parent work'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));expect(screen.getByRole('heading',{name:'todo (0)'})).toHaveFocus();
});
it('keeps filter focus and resets to search rather than the page top', async () => {
 const user=userEvent.setup();render(<Harness />);const search=screen.getByLabelText('Search:');await user.type(search,'Parent work');expect(search).toHaveFocus();await user.selectOptions(screen.getByLabelText('Priority'),'high');expect(screen.getByLabelText('Priority')).toHaveFocus();await user.click(screen.getByRole('button',{name:'Reset'}));expect(search).toHaveFocus();expect(screen.getByRole('button',{name:'Open task Child work'})).toBeInTheDocument();
});
function drop(id: string, status: string) { act(()=>drag.end?.({ active:{id,data:{current:{}},rect:{current:{initial:null,translated:null}}},over:{id:status,disabled:false,data:{current:{}},rect:{top:0,left:0,bottom:100,right:100,width:100,height:100}},delta:{x:0,y:0},activatorEvent:new KeyboardEvent('keydown',{code:'Space'}),collisions:null })); }
it('routes a keyboard drop through workflow validation, announces it and restores task focus', () => {
 render(<Harness />);drop(child.id,'in-progress');expect(within(screen.getByRole('region',{name:'in-progress (1)'})).getByRole('button',{name:'Open task Child work'})).toHaveFocus();expect(updates()).toHaveTextContent('Moved "Child work" to in-progress.');expect(screen.getAllByRole('button',{name:'Open task Child work'})).toHaveLength(1);
 drop(child.id,'done');expect(updates()).toHaveTextContent('Cannot move task from in-progress to done.');expect(within(screen.getByRole('region',{name:'in-progress (1)'})).getByRole('button',{name:'Open task Child work'})).toHaveFocus();
});
it('blocks parent completion from a keyboard drop and announces repeated identical failures', () => {
 render(<Harness tasks={[{...parent,status:'in-review'},child]} />);drop(parent.id,'done');expect(updates()).toHaveTextContent('Finish these subtasks');expect(screen.getByText(/^Warning: Finish these subtasks/)).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();const first=updates().firstChild;drop(parent.id,'done');expect(updates().firstChild).not.toBe(first);expect(screen.getByRole('button',{name:'Open task Parent work'})).toHaveFocus();expect(screen.getAllByRole('button',{name:'Open task Parent work'})).toHaveLength(1);
});
it('does not strand focus when a move hides the task under a status filter', async () => {
 const user=userEvent.setup();render(<Harness />);await user.selectOptions(screen.getByLabelText('Status'),'todo');screen.getByRole('button',{name:'Open task Child work'}).focus();drop(child.id,'in-progress');expect(screen.getByLabelText('Search:')).toHaveFocus();
});
it('dismisses a notification back to the last task without duplicate announcement regions', async () => {
 const user=userEvent.setup();render(<Harness />);drop(child.id,'in-progress');await user.click(screen.getByRole('button',{name:'Dismiss notification: Moved "Child work" to in-progress.'}));expect(screen.getByRole('button',{name:'Open task Child work'})).toHaveFocus();expect(screen.getAllByRole('status')).toHaveLength(1);
});

it('returns first-child creation to the replacement Add SubTask control', async () => {
 const user=userEvent.setup();render(<Harness tasks={[parent]} />);await user.click(screen.getByRole('button',{name:'Edit Parent work'}));await user.click(screen.getByRole('button',{name:'Add SubTask to Parent work'}));const form=within(screen.getByRole('dialog',{name:'Add SubTask'}));await user.type(form.getByLabelText('Title'),'First child');await user.type(form.getByLabelText('Description'),'A child');await user.click(form.getByRole('button',{name:'Create SubTask'}));expect(screen.getByRole('button',{name:'Add SubTask to Parent work'})).toHaveFocus();
});
