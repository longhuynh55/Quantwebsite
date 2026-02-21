import { fireEvent, render, screen } from "@testing-library/react";
import { RangeSlider, Slider } from "./slider";

describe("Slider", () => {
  it("renders accessible label and emits numeric value changes", () => {
    const onChange = jest.fn();

    render(
      <Slider
        label="Risk"
        value={10}
        min={0}
        max={100}
        onChange={onChange}
        showValue
        formatValue={(value) => `${value}%`}
      />
    );

    const input = screen.getByLabelText("Risk");
    expect(screen.getByText("10%")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith(25);
  });
});

describe("RangeSlider", () => {
  it("uses per-thumb aria labels and clamps min thumb to max-step", () => {
    const onChange = jest.fn();

    render(
      <RangeSlider
        label="Allocation"
        value={[20, 80]}
        min={0}
        max={100}
        step={5}
        onChange={onChange}
      />
    );

    const minInput = screen.getByLabelText("Allocation minimum");
    fireEvent.change(minInput, { target: { value: "95" } });

    expect(onChange).toHaveBeenCalledWith([75, 80]);
  });

  it("clamps max thumb to min+step", () => {
    const onChange = jest.fn();

    render(
      <RangeSlider
        label="Allocation"
        value={[20, 80]}
        min={0}
        max={100}
        step={5}
        onChange={onChange}
      />
    );

    const maxInput = screen.getByLabelText("Allocation maximum");
    fireEvent.change(maxInput, { target: { value: "10" } });

    expect(onChange).toHaveBeenCalledWith([20, 25]);
  });
});
