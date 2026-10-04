import { StrictMode, useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import ConfirmModal from './ConfirmModal';
function Harness({ removeTrigger = false }: { removeTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button data-focus-fallback>Fallback</button>{(!open || !removeTrigger) && <button onClick={() => setOpen(true)}>Open confirmation</button>}
    {open && <ConfirmModal title="Delete example" message="This cannot be undone." onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />}</>;
}
it('names and describes the dialog, initially focuses Cancel, and contains Tab in both directions', async () => {
  const user = userEvent.setup(); render(<StrictMode><Harness /></StrictMode>);
  await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete example' });
  expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' }), confirm = within(dialog).getByRole('button', { name: 'Confirm' });
  expect(cancel).toHaveFocus(); await user.tab({ shift: true }); expect(confirm).toHaveFocus(); await user.tab(); expect(cancel).toHaveFocus();
  screen.getByRole('button', { name: 'Fallback' }).focus(); expect(dialog).toContainElement(document.activeElement as HTMLElement);
  expect(screen.getByRole('button', { name: 'Fallback' }).closest('[inert]')).not.toBeNull();
  await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Open confirmation' })).toHaveFocus();
  expect(document.querySelector('[inert]')).toBeNull();
});
it('uses a connected fallback when the opener was removed', async () => {
  const user = userEvent.setup(); render(<Harness removeTrigger />); await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
  await user.keyboard('{Escape}'); expect(screen.getByRole('button', { name: 'Fallback' })).toHaveFocus();
});

it('isolates background controls added while a modal is already open', async () => {
 const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Open confirmation'}));const extra=document.createElement('button');extra.textContent='New background action';document.body.append(extra);
 try { await waitFor(()=>expect(extra).toHaveAttribute('inert'));extra.focus();expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);await user.keyboard('{Escape}');expect(extra).not.toHaveAttribute('inert'); } finally { extra.remove(); }
});
