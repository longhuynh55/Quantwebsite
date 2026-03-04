import { renderHook } from "@testing-library/react";
import { useScrollReveal } from "../useScrollReveal";

describe("useScrollReveal", () => {
    it("returns ref and isVisible=false initially", () => {
        const { result } = renderHook(() => useScrollReveal());
        expect(result.current.ref).toBeDefined();
        expect(result.current.ref.current).toBeNull();
        expect(result.current.isVisible).toBe(false);
    });

    it("returns different defaults with custom options", () => {
        const { result } = renderHook(() =>
            useScrollReveal({ threshold: 0.5, once: false })
        );
        expect(result.current.ref).toBeDefined();
        expect(result.current.isVisible).toBe(false);
    });

    it("does not throw when ref is not attached", () => {
        expect(() => {
            renderHook(() => useScrollReveal());
        }).not.toThrow();
    });

    it("cleans up safely on unmount", () => {
        const { unmount } = renderHook(() => useScrollReveal());
        expect(() => unmount()).not.toThrow();
    });
});
