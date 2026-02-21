# QuantVN Landing Page - Deep Research Design Document

## Executive Summary

Based on comprehensive research of **Composer.trade**, **Koyfin**, and fintech industry best practices, this document outlines a professional landing page design that combines:

- **Composer's** visual storytelling and AI-powered messaging
- **Koyfin's** data credibility and professional positioning
- **Vietnamese market focus** with bilingual support

---

## Competitive Analysis

### Composer.trade Strengths
| Element | What They Do | QuantVN Adaptation |
|---------|--------------|-------------------|
| **Tagline** | "Trading. Built Better." | "Phân tích Đầu tư. Thông minh hơn." |
| **Visual Proof** | Strategy editor screenshots | Backtesting results animations |
| **AI Focus** | AI-assisted strategy creation | AI Assistant for Vietnamese market |
| **Community** | Strategy marketplace | Community strategy sharing |
| **Trust** | WSJ, Money Stuff logos | Vietnam financial news logos |

### Koyfin Strengths
| Element | What They Do | QuantVN Adaptation |
|---------|--------------|-------------------|
| **Positioning** | "Built by investors, for investors" | "Xây dựng bởi nhà đầu tư, cho nhà đầu tư Việt Nam" |
| **Data Coverage** | Asset type grid (Stocks, ETFs, etc.) | HOSE stocks coverage visualization |
| **Features** | Feature cards with icons | Vietnamese-specific features |
| **Testimonials** | Scrolling carousel | Local investor testimonials |
| **CTA** | "Sign up for free" | "Bắt đầu miễn phí" |

---

## Page Architecture

### Visual Flow Map
```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVIGATION BAR                           │
│  Logo │ Features │ Pricing │ About │ [Login] [Get Started ▶]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ██████████████████████  HERO SECTION  ████████████████████████│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │   📊 "Phân Tích Đầu Tư. Thông Minh Hơn."                   ││
│  │   Investment Analysis. Smarter.                            ││
│  │                                                              ││
│  │   Nền tảng phân tích định lượng chuyên nghiệp              ││
│  │   dành riêng cho thị trường chứng khoán Việt Nam           ││
│  │                                                              ││
│  │   [Bắt đầu miễn phí]  [Xem demo ▶]                         ││
│  │                                                              ││
│  │   ┌──────────────────────────────────────────────────────┐ ││
│  │   │   [Animated Dashboard Preview]                        │ ││
│  │   │   - Live chart drawing animation                      │ ││
│  │   │   - Screener results scrolling                        │ ││
│  │   │   - Strategy builder interaction                      │ ││
│  │   └──────────────────────────────────────────────────────┘ ││
│  │                                                              ││
│  │   Được tin tưởng bởi 1,200+ nhà đầu tư                     ││
│  │   [Logo: CafeF] [Logo: Vietstock] [Logo: VnEconomy]        ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  █████████████████████  PROBLEM SECTION  ██████████████████████│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  "Thị trường Việt Nam đang phát triển mạnh,                ││
│  │   nhưng công cụ phân tích vẫn lạc hậu."                    ││
│  │                                                              ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  ││
│  │  │ 📉       │  │ ⏰       │  │ 💸       │                  ││
│  │  │ Quyết    │  │ Mất hàng │  │ Thiếu    │                  ││
│  │  │ định cảm │  │ giờ phân  │  │ công cụ  │                  ││
│  │  │ tính     │  │ tích      │  │ chuyên   │                  ││
│  │  └──────────┘  └──────────┘  └──────────┘                  ││
│  │                                                              ││
│  │  90% nhà đầu tư cá nhân dưới mức trung bình thị trường     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  █████████████████████  SOLUTION SECTION  █████████████████████│
│                                                                 │
│  "Công cụ chuyên nghiệp. Giá cả bình dân.                     │
│   Dành riêng cho nhà đầu tư Việt Nam."                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  BEFORE                      │  AFTER                       ││
│  │  ─────────────────────────────┼───────────────────────────── ││
│  │  Excel spreadsheet           │  Dashboard tương tác        ││
│  │  Phân tích thủ công          │  Lọc cổ phiếu tự động       ││
│  │  Quyết định theo cảm tính   │  Backtest với dữ liệu 7 năm  ││
│  │  3 giờ mỗi ngày              │  15 phút mỗi ngày            ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ██████████████████████  FEATURES SECTION  ████████████████████│
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 📊 SMART SCREENER│  │ 🔬 BACKTESTING   │                    │
│  │                  │  │                  │                    │
│  │ • 400+ mã HOSE  │  │ • 20+ chỉ báo    │                    │
│  │ • 50+ tiêu chí  │  │ • 7 năm dữ liệu  │                    │
│  │ • Lọc realtime  │  │ • So sánh VN-Index│                   │
│  │ • Xuất CSV       │  │ • Metrics chi tiết│                   │
│  │                  │  │                  │                    │
│  │ [Thử ngay →]     │  │ [Thử ngay →]     │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 🎯 STRATEGY      │  │ 📈 ADVANCED      │                    │
│  │    BUILDER       │  │    CHARTS        │                    │
│  │                  │  │                  │                    │
│  │ • Kéo thả đơn giản│  │ • Nến/Line/Area │                    │
│  │ • Không cần code │  │ • MA/RSI/MACD    │                    │
│  │ • AI hỗ trợ      │  │ • Công cụ vẽ     │                    │
│  │ • Lưu & chia sẻ  │  │ • Đồng bộ nhiều  │                    │
│  │                  │  │                  │                    │
│  │ [Thử ngay →]     │  │ [Thử ngay →]     │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 🤖 AI ASSISTANT  │  │ 💼 PORTFOLIO     │                    │
│  │                  │  │    OPTIMIZER     │                    │
│  │ • Gợi ý chiến lược│  │ • Efficient frontier│                │
│  │ • Phân tích thị  │  │ • Ma trận tương quan│                │
│  │   trường VN      │  │ • Cân bằng rủi ro│                    │
│  │ • Tiếng Việt     │  │ • Alert tái cân  │                    │
│  │ • Chat tự nhiên  │  │   bằng vốn       │                    │
│  │                  │  │                  │                    │
│  │ [Chat ngay →]    │  │ [Thử ngay →]     │                    │
│  └──────────────────┘  └──────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ███████████████████  HOW IT WORKS SECTION  ███████████████████│
│                                                                 │
│  "Từ dữ liệu đến quyết định trong vài phút"                   │
│                                                                 │
│       1️⃣           2️⃣           3️⃣           4️⃣              │
│    ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐             │
│    │ Đăng │────▶│ Lọc  │────▶│Test  │────▶│ Thực │             │
│    │ Ký   │     │CP    │     │Strategy│    │Hiện  │             │
│    └──────┘     └──────┘     └──────┘     └──────┘             │
│                                                                 │
│    30 giây      2 phút        5 phút       Theo tin cậy       │
│                                                                 │
│                     [Bắt đầu ngay →]                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ███████████████████  DATA COVERAGE SECTION  ██████████████████│
│                                                                 │
│  "Dữ liệu toàn diện về thị trường Việt Nam"                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        ││
│  │  │  400+   │  │  7 năm  │  │  50+    │  │  Hàng   │        ││
│  │  │ Mã CP   │  │ Dữ liệu │  │ Chỉ số  │  │ Ngày    │        ││
│  │  │ HOSE    │  │ 2018-25 │  │ /CP     │  │ Cập nhật│        ││
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Bao gồm:                                                       │
│  • OHLCV hàng ngày (Giá mở, cao, thấp, đóng, khối lượng)       │
│  • Dữ liệu cơ bản (Bảng cân đối, KQKD, Lưu chuyển tiền tệ)    │
│  • Chỉ số thị trường (VN-Index, VN30, HNX-Index)               │
│  • Phân loại ngành và so sánh peer                              │
│  • Hành động doanh nghiệp và cổ tức                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  █████████████████████  STATS SECTION  ████████████████████████│
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   1,200+    │  │   500,000+  │  │    99.9%    │             │
│  │   Người     │  │   Phân tích │  │   Uptime    │             │
│  │   dùng      │  │   đã chạy   │  │   Server    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ███████████████████  TESTIMONIALS SECTION  ███████████████████│
│                                                                 │
│  "QuantVN giúp tôi tiết kiệm 3 giờ mỗi ngày. Chiến lược MA     │
│   crossover đã giúp tôi đạt 15% lợi nhuận trong 6 tháng."      │
│                                                                 │
│  — Nguyễn Văn A, Nhà đầu tư cá nhân, TP.HCM                   │
│  ★★★★★                                                        │
│                                                                 │
│  [← Previous]  ● ● ○ ○ ○  [Next →]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  █████████████████████  PRICING SECTION  ██████████████████████│
│                                                                 │
│           Miễn phí                    Pro                       │
│         ┌─────────┐              ┌─────────┐                   │
│         │   $0    │              │ $9.99   │                   │
│         │ /tháng  │              │ /tháng  │                   │
│         ├─────────┤              ├─────────┤                   │
│         │✓ 5 backtests│          │✓ Unlimited│                 │
│         │  /ngày   │              │  backtests│                 │
│         │✓ Screener│              │✓ Advanced│                 │
│         │  cơ bản  │              │  screener│                 │
│         │✓ 3 indicators│          │✓ Tất cả indicators│        │
│         │✓ Community│             │✓ AI Assistant│             │
│         │          │              │✓ Priority support│         │
│         │          │              │✓ Export PDF/Excel│         │
│         ├─────────┤              ├─────────┤                   │
│         │[Bắt đầu]│              │[Dùng thử]│                  │
│         └─────────┘              └─────────┘                   │
│                                                                 │
│         💼 Gói Enterprise cho quỹ đầu tư & tổ chức             │
│         [Liên hệ →]                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ████████████████████████  FAQ SECTION  ███████████████████████│
│                                                                 │
│  ▼ QuantVN sử dụng dữ liệu từ đâu?                            │
│    Chúng tôi sử dụng dữ liệu đã xác minh từ HOSE, bao gồm      │
│    400+ mã cổ phiếu với 7 năm dữ liệu giá hàng ngày và        │
│    dữ liệu cơ bản hàng quý.                                    │
│                                                                 │
│  ▼ Dữ liệu của tôi có an toàn không?                          │
│    Có! Chúng tôi sử dụng mã hóa cấp doanh nghiệp và không      │
│    bao giờ lưu trữ thông tin tài khoản chứng khoán của bạn.    │
│                                                                 │
│  ▼ Tôi có thể xuất phân tích không?                           │
│    Hoàn toàn có thể. Xuất chiến lược, kết quả backtest và      │
│    cổ phiếu đã lọc sang CSV hoặc PDF bất cứ lúc nào.          │
│                                                                 │
│  ▼ QuantVN có phải là tư vấn đầu tư không?                    │
│    QuantVN là công cụ phân tích, không phải tư vấn tài chính.  │
│    Mọi quyết định đầu tư đều thuộc về bạn.                     │
│                                                                 │
│  [Xem tất cả FAQ →]                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ██████████████████████  FINAL CTA SECTION  ███████████████████│
│                                                                 │
│        Sẵn sàng nâng tầm chiến lược đầu tư của bạn?           │
│                                                                 │
│        Tham gia cùng 1,200+ nhà đầu tư Việt Nam               │
│        đang sử dụng QuantVN để đưa ra quyết định thông minh.  │
│                                                                 │
│        [Bắt đầu miễn phí - Không cần thẻ tín dụng]            │
│                                                                 │
│        ✓ Gói miễn phí mãi mãi                                  │
│        ✓ Thiết lập trong 30 giây                               │
│        ✓ Hủy bất cứ lúc nào                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  █████████████████████████  FOOTER  ███████████████████████████│
│                                                                 │
│  QuantVN                    Sản phẩm          Tài nguyên        │
│                             ─────────          ─────────        │
│  Nền tảng phân tích         Screener          Tài liệu         │
│  định lượng cho thị         Backtesting       API Docs         │
│  trường chứng khoán         Charts            Blog             │
│  Việt Nam                   Strategy Builder  Hướng dẫn        │
│                             Portfolio         Cộng đồng        │
│  [Logo]                     AI Assistant                       │
│                                                               ││
│  "Dữ liệu thôi thúc quyết định"  Công ty                      │
│                                   ─────────                    │
│  📧 contact@quantvn.vn          Về chúng tôi                   │
│  📍 TP.HCM, Việt Nam            Liên hệ                        │
│                                 Tuyển dụng                      │
│                                 Chính sách bảo mật             │
│                                 Điều khoản sử dụng             │
│                                                                 │
│  © 2025 QuantVN. All rights reserved.                          │
│  Dữ liệu HOSE chỉ mang tính chất tham khảo.                    │
│                                                                 │
│  [Facebook] [YouTube] [LinkedIn] [Zalo]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Specifications

### Color System
```css
/* Primary - Trust & Professionalism */
--primary-50: #eff6ff;
--primary-100: #dbeafe;
--primary-500: #3b82f6;  /* Main blue */
--primary-600: #2563eb;
--primary-700: #1d4ed8;

/* Secondary - Growth & Success */
--secondary-50: #ecfdf5;
--secondary-100: #d1fae5;
--secondary-500: #10b981;  /* Emerald */
--secondary-600: #059669;

/* Accent - Innovation & AI */
--accent-50: #f5f3ff;
--accent-100: #ede9fe;
--accent-500: #8b5cf6;  /* Violet */
--accent-600: #7c3aed;

/* Dark Mode Base */
--dark-50: #f8fafc;
--dark-100: #f1f5f9;
--dark-800: #1e293b;
--dark-900: #0f172a;
--dark-950: #020617;
```

### Typography
```css
/* Headings */
--font-heading: 'Inter', sans-serif;
font-weight: 700-900;
line-height: 1.1;
letter-spacing: -0.02em;

/* Body */
--font-body: 'Inter', sans-serif;
font-weight: 400-500;
line-height: 1.6;

/* Numbers/Code */
--font-mono: 'JetBrains Mono', monospace;
```

### Animation Tokens
```css
/* Entrance animations */
--animate-fade-up: fadeUp 0.6s ease-out;
--animate-fade-in: fadeIn 0.4s ease-out;
--animate-scale-in: scaleIn 0.3s ease-out;

/* Interaction */
--animate-hover-lift: translateY(-2px);
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 400ms ease;

/* Count-up animation for stats */
--animate-count-up: countUp 2s ease-out;
```

---

## Component Architecture

### File Structure
```
src/app/(landing)/
├── page.tsx                    # Main landing page
├── layout.tsx                  # Landing layout (no sidebar)
├── loading.tsx                 # Loading skeleton
│
├── _components/
│   ├── Navigation.tsx          # Sticky nav with CTA
│   ├── HeroSection.tsx         # Hero with animated preview
│   ├── ProblemSection.tsx      # Pain points
│   ├── SolutionSection.tsx     # Before/After
│   ├── FeaturesSection.tsx     # 6 feature cards
│   ├── HowItWorksSection.tsx   # 4-step process
│   ├── DataCoverageSection.tsx # Stats & data grid
│   ├── StatsSection.tsx        # Animated counters
│   ├── TestimonialsSection.tsx # Carousel
│   ├── PricingSection.tsx      # Free/Pro comparison
│   ├── FAQSection.tsx          # Accordion
│   ├── CTASection.tsx          # Final call-to-action
│   ├── Footer.tsx              # Links & contact
│   │
│   ├── ui/
│   │   ├── AnimatedNumber.tsx  # Count-up animation
│   │   ├── AnimatedChart.tsx   # Live chart preview
│   │   ├── FeatureCard.tsx     # Feature card component
│   │   ├── TestimonialCard.tsx # Testimonial component
│   │   ├── PricingCard.tsx     # Pricing tier card
│   │   └── FAQItem.tsx         # Accordion item
│   │
│   └── animations/
│       ├── fadeInUp.tsx        # Framer Motion variants
│       ├── stagger.tsx         # Stagger container
│       └── scrollReveal.tsx    # Intersection observer
│
└── _lib/
    ├── constants.ts            # Copy text (bilingual)
    └── animations.ts           # Animation variants
```

---

## Content Strategy

### Bilingual Approach
- **Primary**: Vietnamese (for local market)
- **Secondary**: English (for international credibility)
- **Implementation**: Vietnamese headlines, English subtitles

### Copywriting Guidelines
1. **Headlines**: Action-oriented, benefit-focused
2. **Subheadlines**: Specific numbers and outcomes
3. **CTAs**: First-person perspective ("Bắt đầu" vs "Get Started")
4. **Social Proof**: Real metrics, real testimonials

### SEO Keywords (Vietnamese)
- "phân tích chứng khoán Việt Nam"
- "backtest chiến lược đầu tư"
- "screener cổ phiếu HOSE"
- "phân tích định lượng"
- "công cụ đầu tư chứng khoán"

---

## Technical Implementation Notes

### Performance
- Lazy load below-fold sections
- Use `next/image` for all images
- Implement view transitions for smooth navigation
- Prefetch login/signup pages

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly
- Color contrast ratios ≥ 4.5:1

### Analytics Events
```typescript
// Track these events
events = [
  'landing_page_view',
  'hero_cta_click',
  'feature_card_click',
  'pricing_toggle',
  'testimonial_scroll',
  'faq_expand',
  'final_cta_click',
]
```

---

## Implementation Priority

### Phase 1: Core Landing Page (Week 1)
1. Navigation with dark mode toggle
2. Hero section with animated preview
3. Features section (6 cards)
4. Final CTA section
5. Footer

### Phase 2: Social Proof (Week 2)
1. Stats section with animations
2. Testimonials carousel
3. Data coverage section
4. Trust logos

### Phase 3: Conversion Optimization (Week 3)
1. Problem/Solution sections
2. How it works section
3. Pricing section
4. FAQ section

---

## Next Steps

1. **Review and approve** this design document
2. **Create component files** in `src/app/(landing)/_components/`
3. **Implement animations** with Framer Motion
4. **Add Vietnamese copy** for all sections
5. **Test responsive** on mobile/tablet/desktop
6. **Integrate analytics** for tracking

Ready to implement? Let me know and I'll start building the components!
