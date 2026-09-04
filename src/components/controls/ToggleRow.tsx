'use client';

import { Switch } from '@/components/ui/switch';

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="toggle-row">
      <div>
        <p>{label}</p>
        {description && <span>{description}</span>}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
