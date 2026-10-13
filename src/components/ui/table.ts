/** Shared table classes. Tables are flat: hairline row separators, no zebra fills or cards. */
export const tableClasses = {
  wrapper: 'w-full overflow-x-auto',
  table: 'w-full border-collapse text-left text-sm',
  th: 'label-caps border-b border-line px-3 py-2 font-semibold whitespace-nowrap first:pl-0 last:pr-0',
  thNum: 'label-caps border-b border-line px-3 py-2 text-right font-semibold whitespace-nowrap last:pr-0',
  td: 'border-b border-line px-3 py-3 align-middle first:pl-0 last:pr-0',
  tdNum: 'num border-b border-line px-3 py-3 text-right align-middle whitespace-nowrap last:pr-0',
  row: 'transition-colors hover:bg-surface',
}
