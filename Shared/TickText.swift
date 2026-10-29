import SwiftUI

/// TradingView-style tick: the digits that changed take the tick colour, the unchanged lead keeps the base colour.
/// "1,003.50" to "1,003.75" lights up "75" only.
func tickText(_ new: String, previous: String?, tick: Color?, base: Color) -> Text {
    guard let previous, let tick else { return Text(new).foregroundColor(base) }
    let same = zip(new, previous).prefix { $0 == $1 }.count
    var lead = AttributedString(String(new.prefix(same)))
    lead.foregroundColor = base
    var rest = AttributedString(String(new.dropFirst(same)))
    rest.foregroundColor = tick
    return Text(lead + rest)
}
