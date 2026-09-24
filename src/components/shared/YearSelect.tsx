import { SingleSelect } from "@/components/ui/SingleSelect";
import { VEHICLE_YEAR_OPTIONS } from "@/config/vehicleYears";

interface YearSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}

const YEAR_OPTIONS = VEHICLE_YEAR_OPTIONS.map((year) => ({ value: String(year), label: String(year) }));

// NOTE: "" is a real option here (Year To "Present" clears it), not a prompt.
export function YearSelect({ value, onChange, placeholder = "Select year…", disabled, id, ...rest }: YearSelectProps) {
  return (
    <SingleSelect
      id={id}
      options={[{ value: "", label: placeholder }, ...YEAR_OPTIONS]}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={value === "" ? "text-fg/45" : undefined}
      {...rest}
    />
  );
}
