import SwiftUI

/// Shared first-run welcome screen, in the Apple Stocks style: "Welcome to / AppName",
/// up to three feature rows, one Continue button. Copy this file verbatim into any app
/// that needs it, then hang it off the root view:
///
///     ContentView()
///         .onboarding(key: "spark", signedIn: appState.isLoggedIn, slides: Onboarding.spark)
///
/// Shows once per install, right after the user registers: never to signed-out
/// visitors, and never to an account that was already signed in at launch.
/// Reset in the simulator with `defaults delete <bundle-id> onboarded_spark`.
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

    private var appName: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
            ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 48) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Welcome to").foregroundStyle(.tint)
                        Text(appName)
                    }
                    .font(.largeTitle.bold())
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isHeader)

                    VStack(alignment: .leading, spacing: 32) {
                        ForEach(slides.prefix(3)) { slide in
                            HStack(alignment: .top, spacing: 16) {
                                Image(systemName: slide.symbol)
                                    .font(.largeTitle)
                                    .foregroundStyle(.tint)
                                    .frame(width: 44)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(slide.title).fontWeight(.semibold)
                                    Text(slide.body).foregroundStyle(.secondary)
                                }
                                .font(.title3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(.top, 96)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize)

            Button(action: onFinish) {
                Text(finishLabel)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .padding(.vertical, 16)
        }
        .padding(.horizontal, 32)
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
    @State private var settled = false

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
            // asynchronously at launch, so signedIn reads false for the first frames.
            // Once auth has settled, anyone already signed in existed before and is
            // stamped as seen. A later false-to-true flip is a fresh sign-up (or a sign-in
            // on a new install, the known ceiling) and shows the slides once.
            .task {
                try? await Task.sleep(for: .milliseconds(700))
                if signedIn { seen = true }
                settled = true
            }
            .onChange(of: signedIn) { _, nowSignedIn in
                guard nowSignedIn, !seen else { return }
                // The task above keeps the signedIn it was built with, so a session restored inside the
                // settle window has to be stamped here or it never is.
                if !settled { seen = true } else if !slides.isEmpty { showing = true }
            }
            .fullScreenCoverCompat(isPresented: $showing) {
                OnboardingView(slides: slides, finishLabel: finishLabel) {
                    seen = true
                    showing = false
                    onFinish()
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
                    finishLabel: String = "Continue",
                    onFinish: @escaping () -> Void = {}) -> some View {
        modifier(OnboardingModifier(key: key, signedIn: signedIn, slides: slides,
                                    finishLabel: finishLabel, onFinish: onFinish))
    }
}
