import SwiftUI

/// Topic chips for the news list. The feed carries no tags, so a headline's topics come from keywords.
/// ponytail: keyword lists, case-insensitive whole words; a classifier if the misses get annoying.
enum NewsTopics {
    static let all = "All"
    private static let patterns: [(String, String)] = [
        ("Markets", #"\b(stocks?|shares|s&p|nasdaq|dow|wall street|rally|sell-?off|ipo|futures|bonds?|index|markets|stock market|investors)\b"#),
        ("Crypto", #"\b(bitcoin|crypto\w*|ethereum|ether|btc|binance|coinbase|stablecoins?|solana|xrp|blockchain|dogecoin)\b"#),
        ("Earnings", #"\b(earnings|quarterly|q[1-4]|revenue|profits?|guidance|outlook|eps|results|beats|misses|forecast|(first|second|third|fourth)-quarter)\b"#),
        ("Economy", #"\b(fed|federal reserve|inflation|cpi|jobs report|unemployment|gdp|interest rates?|rate cut|recession|tariffs?|treasury|economy|economic|bank of canada|payrolls|housing starts)\b"#),
    ]

    static func topics(_ title: String) -> Set<String> {
        Set(patterns.compactMap { name, pattern in
            title.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil ? name : nil
        })
    }

    /// "All" plus each topic that splits the list (some headlines, not every one), in a fixed order.
    static func chips(_ titles: [String]) -> [String] {
        let tagged = titles.map(topics)
        return [all] + patterns.map(\.0).filter { name in
            let n = tagged.filter { $0.contains(name) }.count
            return n > 0 && n < titles.count
        }
    }

    static func passes(_ title: String, _ chip: String) -> Bool { chip == all || topics(title).contains(chip) }

    /// Headlines naming a stock you hold or watch.
    static let yours = "Yours"

    /// The chips with "Yours" after All when some headline names one of `mine`.
    static func chips(_ titles: [String], mine: [Stock]) -> [String] {
        var c = chips(titles)
        if titles.contains(where: { !HeadlineSymbols.match($0, in: mine, limit: 1).isEmpty }) { c.insert(yours, at: 1) }
        return c
    }

    static func passes(_ title: String, _ chip: String, mine: [Stock]) -> Bool {
        chip == yours ? !HeadlineSymbols.match(title, in: mine, limit: 1).isEmpty : passes(title, chip)
    }
}

/// Topic chips in a row that scrolls, so six topics never truncate the way a segmented control does.
struct TopicChips: View {
    let chips: [String]
    @Binding var selection: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chips, id: \.self) { chip in
                    let on = chip == selection || (chip == NewsTopics.all && !chips.contains(selection))
                    Button { selection = chip } label: {
                        Text(chip)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(on ? Color.primary : Color.primary.opacity(0.08), in: Capsule())
                            .foregroundStyle(on ? AnyShapeStyle(.background) : AnyShapeStyle(.primary))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
    }
}
