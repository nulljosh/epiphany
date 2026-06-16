import SwiftUI

struct BriefDrawerView: View {
    let brief: DailyBrief?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Daily Brief")
                    .font(.headline.weight(.semibold))
                Spacer()
            }
            .padding()

            if let brief {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(brief.summary ?? "No brief available")
                            .font(.body)
                            .lineLimit(nil)
                        Spacer()
                    }
                    .padding()
                }
            } else {
                ContentUnavailableView(
                    "No Brief",
                    systemImage: "doc.text",
                    description: Text("Daily brief unavailable right now.")
                )
            }
        }
    }
}
