import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScreenerClient from "./ScreenerClient";

const mockFetch = jest.fn();

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      href,
      children,
      onClick,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    ),
  };
});

jest.mock("@/lib/hooks", () => {
  return {
    useUrlState: (_key: string, defaultValue: unknown) => React.useState(defaultValue),
  };
});

function createFetchResponse(
  body: unknown,
  options?: { ok?: boolean; status?: number }
): Promise<Response> {
  const ok = options?.ok ?? true;
  const status = options?.status ?? 200;
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

const successPayload = {
  stocks: [
    {
      symbol: "FPT",
      status: "ACTIVE",
      listingPhase: "LISTED",
      avgVolume: 1234567,
      totalTradingDays: 250,
      icbName4: "Technology",
      organName: "FPT Corporation",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
};

describe("ScreenerClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
  });

  it("loads and renders screener rows", async () => {
    mockFetch.mockResolvedValue(createFetchResponse(successPayload));

    render(<ScreenerClient />);

    expect(await screen.findByText("FPT")).toBeInTheDocument();
    expect(screen.getByText("FPT Corporation")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("applies uppercase search query and refetches", async () => {
    mockFetch.mockResolvedValue(createFetchResponse(successPayload));

    render(<ScreenerClient />);
    await screen.findByText("FPT");

    const searchInput = screen.getByPlaceholderText("Type a symbol (e.g., FPT, VNM)");
    fireEvent.change(searchInput, { target: { value: "vnm" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    const latestCallUrl = String(mockFetch.mock.calls.at(-1)?.[0] ?? "");
    expect(latestCallUrl).toContain("search=VNM");
  });

  it("shows error state and retries successfully", async () => {
    mockFetch
      .mockResolvedValueOnce(
        createFetchResponse({ error: "Server unavailable" }, { ok: false, status: 500 })
      )
      .mockResolvedValueOnce(createFetchResponse(successPayload));

    render(<ScreenerClient />);

    expect(await screen.findByText("Screener data unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText("FPT")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
