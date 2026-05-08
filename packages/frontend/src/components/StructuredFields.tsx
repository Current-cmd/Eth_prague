import { CATEGORY_FIELDS, type Field } from "../lib/categoryFields";
import type { ReportCategory } from "@shieldpass/shared/enums";

interface StructuredFieldsProps {
  category: ReportCategory;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export function StructuredFields({ category, value, onChange }: StructuredFieldsProps) {
  const fields = CATEGORY_FIELDS[category];
  const setField = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">
            {f.label}{f.required && <span className="text-alert"> *</span>}
          </label>
          <FieldInput field={f} value={value[f.key]} onChange={(v) => setField(f.key, v)} />
          {f.help && <div className="font-mono text-[10px] text-paper3 mt-1">{f.help}</div>}
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const cls = "w-full bg-ink border border-rule2 text-paper text-[13px] p-3 focus:outline-none focus:border-paper3";
  const v = value;

  if (field.kind === "textarea") {
    return (
      <textarea
        rows={4}
        maxLength={field.maxLength}
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "text") {
    return (
      <input
        type="text"
        maxLength={field.maxLength}
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "date") {
    return (
      <input
        type="date"
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <select
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      >
        <option value="">— pick one —</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  // url-list
  const list = ((v as string[]) ?? []) as string[];
  return (
    <div className="space-y-2">
      {list.map((url, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="https://…"
            className={cls}
            style={{ borderRadius: 0 }}
          />
          <button
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-paper3 hover:text-alert"
            style={{ borderRadius: 0 }}
          >
            remove
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...list, ""])}
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper3 hover:text-paper"
        style={{ borderRadius: 0 }}
      >
        + add url
      </button>
    </div>
  );
}
