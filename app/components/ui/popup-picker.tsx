import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

export type PopupPickerOption<Value extends string> = {
  value: Value;
  label: string;
};

type PopupPickerProps<Value extends string> = {
  ariaLabel: string;
  emptyLabel: string;
  options: PopupPickerOption<Value>[];
  selectedValue: Value | null;
  onSelect: (value: Value) => void;
};

export function PopupPicker<Value extends string>({
  ariaLabel,
  emptyLabel,
  options,
  selectedValue,
  onSelect,
}: PopupPickerProps<Value>) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={pickerId}
        className="inline-flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-base disabled:opacity-25"
        disabled={!options.length}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedOption?.label ?? emptyLabel}
        <Icon className="size-5" icon="mdi:chevron-down" />
      </button>

      {open && options.length ? (
        <div className="absolute right-0 bottom-full mb-1 min-w-max border-y-2 border-black bg-white" id={pickerId} role="listbox">
          <ul>
            {options.map((option) => (
              <li className="min-h-11 px-3 py-2" key={option.value}>
                <button
                  className={`block w-full text-left text-base ${option.value === selectedValue ? "font-bold" : ""}`}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
