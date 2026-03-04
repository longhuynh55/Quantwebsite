import { render, screen } from "@testing-library/react";
import { MidPageCTA } from "../sections/MidPageCTA";

// Mock Next.js Link
jest.mock("next/link", () => {
    const MockLink = ({
        children,
        href,
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a href={href}>{children}</a>;
    MockLink.displayName = "MockLink";
    return MockLink;
});

// Mock ScrollReveal
jest.mock("../ui/ScrollReveal", () => ({
    ScrollReveal: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

describe("MidPageCTA", () => {
    it("renders CTA heading in serif", () => {
        render(<MidPageCTA />);
        expect(screen.getByText(/Sẵn Sàng Thử/i)).toBeInTheDocument();
    });

    it("renders link to /dashboard", () => {
        render(<MidPageCTA />);
        const link = screen.getByRole("link", { name: /Dùng Thử Miễn Phí/i });
        expect(link).toHaveAttribute("href", "/dashboard");
    });

    it("renders \"Không cần thẻ tín dụng\" text", () => {
        render(<MidPageCTA />);
        expect(screen.getByText(/Không cần thẻ tín dụng/i)).toBeInTheDocument();
    });
});
