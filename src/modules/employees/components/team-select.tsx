"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ADD_NEW = "__add_new_team__";

/**
 * Team picker that follows the chosen department's teams (a styled dropdown,
 * not a native datalist). Choosing "Add a new team…" — or any department with
 * no preset teams — swaps to a free-text input so a brand-new team can still be
 * created. Fully controlled: `value` is the team name, "" when unset.
 */
export function TeamSelect({
  teams,
  value,
  onChange,
  disabled,
}: {
  teams: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState(false);

  // Reset back to the dropdown whenever the available teams change (e.g. the
  // department changed). Keyed on a primitive so it's stable across renders.
  const teamsKey = teams.join("|");
  useEffect(() => {
    setCustom(false);
  }, [teamsKey]);

  if (disabled) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pick a department first" />
        </SelectTrigger>
      </Select>
    );
  }

  // A value that isn't one of the preset teams is, by definition, a custom one.
  const isCustomValue = value !== "" && !teams.includes(value);
  const showInput = teams.length === 0 || custom || isCustomValue;

  if (showInput) {
    return (
      <div className="space-y-1.5">
        <Input
          autoFocus
          placeholder="New team name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {teams.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              onChange("");
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Choose from existing teams
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const next = v as string;
        if (next === ADD_NEW) {
          setCustom(true);
          onChange("");
        } else {
          onChange(next);
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a team" />
      </SelectTrigger>
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
        <SelectItem value={ADD_NEW}>+ Add a new team…</SelectItem>
      </SelectContent>
    </Select>
  );
}
