import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { NumberStepper } from "./number-stepper";

function Harness({ initial = 30, min = 1, max = 365, step = 1 }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberStepper
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        step={step}
        aria-label="Retention"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const input = () => screen.getByRole("spinbutton", { name: "Retention" }) as HTMLInputElement;
const value = () => screen.getByTestId("value").textContent;

/** WP-361: the field ignored "", clamped per keystroke and took decimals into a u16 field. */
describe("NumberStepper", () => {
  it("can be cleared and retyped — 30 → 45, not 345", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "3" } });
    fireEvent.change(input(), { target: { value: "" } });
    expect(input().value).toBe("");
    fireEvent.change(input(), { target: { value: "4" } });
    fireEvent.change(input(), { target: { value: "45" } });
    fireEvent.blur(input());
    expect(value()).toBe("45");
    expect(input().value).toBe("45");
  });

  it("clamps when the field is left, not on every keystroke", () => {
    render(<Harness initial={10} min={5} max={60} />);
    fireEvent.change(input(), { target: { value: "1" } }); // on the way to "12"
    expect(value()).toBe("10");
    fireEvent.change(input(), { target: { value: "12" } });
    expect(value()).toBe("12");
    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.blur(input());
    expect(value()).toBe("5");
  });

  it("accepts digits only — no decimals or exponents reach the value", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "4.2e" } });
    expect(input().value).toBe("42");
    expect(value()).toBe("42");
  });

  it("steps by `step` from the arrow keys", () => {
    render(<Harness initial={10} step={5} />);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(value()).toBe("15");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(value()).toBe("5");
  });
});
