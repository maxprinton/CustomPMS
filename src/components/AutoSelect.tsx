"use client";

type Option = { value: string; label: string };

/** A select that submits its form as soon as the value changes. */
export default function AutoSelect({ name, value, options, label }: { name: string; value: string; options: Option[]; label: string }) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="input input-sm"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
