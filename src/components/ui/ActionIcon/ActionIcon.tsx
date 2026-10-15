export type ActionIconName = "plus" | "edit" | "trash";
const paths: Record<ActionIconName, string> = {
  plus: "M8 3v10M3 8h10",
  edit: "m10.7 2.8 2.5 2.5M3 13l3.1-.6 7-7a1.8 1.8 0 0 0-2.5-2.5l-7 7L3 13Z",
  trash: "M2.5 4.5h11M6 4.5V2.7h4v1.8M4 4.5l.6 9h6.8l.6-9M6.5 7v4M9.5 7v4",
};
export default function ActionIcon({ name }: { name: ActionIconName }) {
  return <svg className="action-icon" aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
