import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import App from './App';
it('announces a storage failure once, contains recovery confirmation and restores its opener', async () => {
 localStorage.setItem('taskflow-board','invalid');const user=userEvent.setup();render(<App/>);expect(screen.getAllByRole('alert')).toHaveLength(1);
 const reload=screen.getByRole('button',{name:'Reload saved board'});await user.click(reload);const dialog=screen.getByRole('dialog',{name:'Reload Saved Board?'});expect(dialog).toHaveAccessibleDescription(/Reloading discards unsaved work/);const buttons=within(dialog);expect(buttons.getByRole('button',{name:'Cancel'})).toHaveFocus();await user.tab({shift:true});expect(buttons.getByRole('button',{name:'Reload Saved Board'})).toHaveFocus();await user.tab();expect(buttons.getByRole('button',{name:'Cancel'})).toHaveFocus();await user.keyboard('{Escape}');expect(reload).toHaveFocus();expect(localStorage.getItem('taskflow-board')).toBe('invalid');
});
