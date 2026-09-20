import SwiftUI

/// Shared first-run onboarding. Copy this file verbatim into any app that needs it,
/// then hang it off the root view:
///
///     ContentView()
///         .onboarding(key: "spark", signedIn: appState.isLoggedIn, slides: Onboarding.spark) {
///             appState.showSignUp = true
///         }
///
/// Shows once per install for signed-out newcomers. Reset in the simulator with
/// `defaults delete <bundle-id> onboarded_spark`.
struct OnboardingSlide: Identifiable {
    let id = UUID()
    let symbol: String
    let title: String
    let body: String
}

struct OnboardingView: View {
    let slides: [OnboardingSlide]
    let finishLabel: String
    let onFinish: () -> Void
    let onSkip: () -> Void

    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isLast: Bool { index == slides.count - 1 }

    var body: some View {
        VStack(spacing: 24) {
            TabView(selection: $index) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { i, slide in
                    VStack(spacing: 16) {
                        Image(systemName: slide.symbol)
                            .font(.system(size: 72, weight: .light))
                            .foregroundStyle(.tint)
                            .frame(height: 140)
                        Text(slide.title)
                            .font(.title.bold())
                            .multilineTextAlignment(.center)
                        Text(slide.body)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 32)
                    .tag(i)
                }
            }
            #if os(iOS)
            .tabViewStyle(.page(indexDisplayMode: .always))
            #endif

            VStack(spacing: 8) {
                Button {
                    if isLast {
                        onFinish()
                    } else {
                        // ponytail: animation is the only motion here, so gating it is the whole
                        // reduce-motion story. No separate static path needed.
                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { index += 1 }
                    }
                } label: {
                    Text(isLast ? finishLabel : "Next")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)

                Button("Skip", action: onSkip)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .opacity(isLast ? 0 : 1)
                    .disabled(isLast)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        #if os(iOS)
        .background(Color(.systemBackground).ignoresSafeArea())
        #else
        .background(Color(nsColor: .windowBackgroundColor).ignoresSafeArea())
        #endif
    }
}

private struct OnboardingModifier: ViewModifier {
    let storageKey: String
    let signedIn: Bool
    let slides: [OnboardingSlide]
    let finishLabel: String
    let onFinish: () -> Void

    @AppStorage private var seen: Bool
    @State private var showing = false

    init(key: String, signedIn: Bool, slides: [OnboardingSlide], finishLabel: String, onFinish: @escaping () -> Void) {
        self.storageKey = "onboarded_" + key
        self.signedIn = signedIn
        self.slides = slides
        self.finishLabel = finishLabel
        self.onFinish = onFinish
        _seen = AppStorage(wrappedValue: false, "onboarded_" + key)
    }

    func body(content: Content) -> some View {
        content
            // ponytail: the wait is the whole point. Apps restore their session
            // asynchronously at launch, so signedIn reads false for the first frames and
            // deciding on .onAppear would flash onboarding at signed-in users. Decide once
            // auth has had a moment, and back out if it resolves late.
            .task {
                try? await Task.sleep(for: .milliseconds(700))
                showing = !seen && !signedIn && !slides.isEmpty
            }
            .onChange(of: signedIn) { _, nowSignedIn in
                if nowSignedIn { showing = false }
            }
            .fullScreenCoverCompat(isPresented: $showing) {
                OnboardingView(slides: slides, finishLabel: finishLabel) {
                    seen = true
                    showing = false
                    onFinish()
                } onSkip: {
                    seen = true
                    showing = false
                }
                .interactiveDismissDisabled()
            }
    }
}

private extension View {
    @ViewBuilder
    func fullScreenCoverCompat<C: View>(isPresented: Binding<Bool>, @ViewBuilder content: @escaping () -> C) -> some View {
        #if os(iOS)
        fullScreenCover(isPresented: isPresented, content: content)
        #else
        sheet(isPresented: isPresented) { content().frame(minWidth: 420, minHeight: 520) }
        #endif
    }
}

extension View {
    func onboarding(key: String,
                    signedIn: Bool,
                    slides: [OnboardingSlide],
                    finishLabel: String = "Get started",
                    onFinish: @escaping () -> Void = {}) -> some View {
        modifier(OnboardingModifier(key: key, signedIn: signedIn, slides: slides,
                                    finishLabel: finishLabel, onFinish: onFinish))
    }
}
