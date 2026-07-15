import { Button } from "./Button";
import { ChevronDown } from "./icons";

export interface SelectFilter {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

/**
 * The reference's filter row: labelled selects on a hairline-bordered panel,
 * with a solid near-black "Apply" and a bare-text "Reset".
 */
export function FilterBar({
  filters,
  onChange,
  onApply,
  onReset,
  applying,
}: {
  filters: SelectFilter[];
  onChange: (key: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  applying?: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-panel px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        {filters.map((filter) => (
          <label key={filter.key} className="flex min-w-[150px] flex-1 flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-soft">
              {filter.label}
            </span>
            <span className="relative">
              <select
                value={filter.value}
                onChange={(event) => onChange(filter.key, event.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-hairline-strong bg-panel pl-2.5 pr-8 text-[13px] text-ink transition-colors duration-150 hover:border-faint focus:border-brand focus:outline-none"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
            </span>
          </label>
        ))}

        <div className="flex items-center gap-1">
          <Button variant="dark" onClick={onApply} disabled={applying}>
            {applying ? "Applying…" : "Apply"}
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
