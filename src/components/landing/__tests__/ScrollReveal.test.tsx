import { render, screen } from "@testing-library/react";
import { ScrollReveal } from "../ui/ScrollReveal";

// Mock useScrollReveal
let mockIsVisible = false;
jest.mock("@/lib/hooks/useScrollReveal", () => ({
    useScrollReveal: () => ({
        ref: { current: null },
        isVisible: mockIsVisible,
    }),
}));

describe("ScrollReveal", () => {
    beforeEach(() => {
        mockIsVisible = false;
    });

    it("renders children", () => {
        render(
            <ScrollReveal>
                <p>Hello World</p>
            </ScrollReveal>
        );
        expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("applies opacity 0 when not visible", () => {
        mockIsVisible = false;
        const { container } = render(
            <ScrollReveal>
                <p>Content</p>
            </ScrollReveal>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.style.opacity).toBe("0");
    });

    it("applies opacity 1 when visible", () => {
        mockIsVisible = true;
        const { container } = render(
            <ScrollReveal>
                <p>Content</p>
            </ScrollReveal>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.style.opacity).toBe("1");
    });

    it("applies delay as transition-delay", () => {
        const { container } = render(
            <ScrollReveal delay={0.2}>
                <p>Delayed</p>
            </ScrollReveal>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.style.transitionDelay).toBe("0.2s");
    });

    it("passes className to wrapper", () => {
        const { container } = render(
            <ScrollReveal className="my-custom-class">
                <p>Styled</p>
            </ScrollReveal>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.classList.contains("my-custom-class")).toBe(true);
    });
});
