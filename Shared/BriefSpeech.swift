import AVFoundation
import SwiftUI

/// The daily brief as one passage to read aloud: the summary, then each point. Mirrors briefSpeech in brief.js.
enum BriefSpeech {
    static func text(_ brief: DailyBrief) -> String {
        ([brief.summary].compactMap { $0 } + brief.points)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .map { $0.last.map { ".!?".contains($0) } == true ? $0 : $0 + "." }
            .joined(separator: " ")
    }
}

/// Reads text with the on-device voice; tap again to stop.
@MainActor @Observable
final class BriefSpeaker: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var speaking = false
    private let synth = AVSpeechSynthesizer()

    override init() {
        super.init()
        synth.delegate = self
    }

    func toggle(_ text: String) {
        if speaking { synth.stopSpeaking(at: .immediate); speaking = false; return }
        synth.speak(AVSpeechUtterance(string: text))
        speaking = true
    }

    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { Task { @MainActor in self.speaking = false } }
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { Task { @MainActor in self.speaking = false } }
}

/// A Listen button that reads the daily brief aloud, and stops it.
struct BriefListenButton: View {
    let brief: DailyBrief
    @State private var speaker = BriefSpeaker()

    var body: some View {
        Button {
            speaker.toggle(BriefSpeech.text(brief))
        } label: {
            Label(speaker.speaking ? "Stop" : "Listen", systemImage: speaker.speaking ? "stop.fill" : "speaker.wave.2.fill")
                .font(.caption.weight(.semibold))
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .accessibilityLabel(speaker.speaking ? "Stop reading the brief" : "Read the brief aloud")
        .onDisappear { if speaker.speaking { speaker.toggle("") } }
    }
}

/// The daily brief's points with a Listen button, for the iPhone news drawer.
struct DailyBriefCard: View {
    let brief: DailyBrief

    var body: some View {
        if !brief.points.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Daily Brief").font(.headline)
                    Spacer()
                    BriefListenButton(brief: brief)
                }
                ForEach(brief.points.prefix(4), id: \.self) { point in
                    HStack(alignment: .top, spacing: 6) {
                        Circle().fill(Palette.appleBlue).frame(width: 4, height: 4).padding(.top, 6)
                        Text(point).font(.subheadline).lineLimit(3)
                    }
                }
            }
        }
    }
}
