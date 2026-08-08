import { NativeSelect } from "@/components/ui/Select";
import { VEHICLE_YEAR_OPTIONS } from "@/config/vehicleYears";

interface YearSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}

// Replaces a free-text `<input type="number">` for a vehicle model year —
// typed numeric inputs let a user enter "19", "20500", or "-1", none of
// which are real model years. A bounded dropdown makes an invalid year
// structurally impossible instead of relying on validation to catch it
// after the fact.
export function YearSelect({ value, onChange, placeholder = "Select year…", disabled, id, ...rest }: YearSelectProps) {
  return (
    <NativeSelect
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      {...rest}
    >
      <option value="">{placeholder}</option>
      {VEHICLE_YEAR_OPTIONS.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </NativeSelect>
  );
}
