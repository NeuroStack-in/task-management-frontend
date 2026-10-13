import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhoneInput } from "./phone-input";

/** A controlled host, so each emitted value is fed back exactly as a real form would. */
function Host({ initial, seen }: { initial: string; seen: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneInput
      id="phone"
      value={value}
      onChange={(v) => {
        seen.push(v);
        setValue(v);
      }}
    />
  );
}

const numberBox = () => screen.getByRole("textbox") as HTMLInputElement;

/** WP-362 (QA audit 2026-10-08). */
describe("PhoneInput", () => {
  it("can be cleared once a country is set — it used to emit the bare dial code", () => {
    const seen: string[] = [];
    render(<Host initial="+919876543210" seen={seen} />);
    fireEvent.change(numberBox(), { target: { value: "" } });
    expect(seen.at(-1)).toBe("");
    // The country stays on screen for the next number typed.
    expect(screen.getByRole("button", { name: "Country: India" })).toBeInTheDocument();
  });

  it("reads a pasted international number as one", () => {
    const seen: string[] = [];
    render(<Host initial="+91" seen={seen} />);
    fireEvent.change(numberBox(), { target: { value: "+91 98765 43210" } });
    expect(seen.at(-1)).toBe("+919876543210");

    // …including with no country chosen, where the `+` used to be stripped into a local number.
    const seen2: string[] = [];
    render(<Host initial="" seen={seen2} />);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "+44 20 7946 0958" } });
    expect(seen2.at(-1)).toBe("+442079460958");
  });

  it("shows a US number as the United States, not the Bahamas", () => {
    render(<Host initial="+12025550123" seen={[]} />);
    expect(screen.getByRole("button", { name: "Country: United States" })).toBeInTheDocument();
  });
});
