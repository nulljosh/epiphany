import SwiftUI

struct SplashView: View {
    @State private var iconScale: CGFloat = 0.8
    @State private var iconOpacity: Double = 0
    @State private var textOpacity: Double = 0

    var body: some View {
        ZStack {
            Palette.bg
                .ignoresSafeArea()

            VStack(spacing: 20) {
                Image("SplashIcon")
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 200, height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 44, style: .continuous))
                    .scaleEffect(iconScale)
                    .opacity(iconOpacity)

                Text("EPIPHANY")
                    .font(.system(size: 16, weight: .light))
                    .tracking(8)
                    .foregroundStyle(Palette.overlay.opacity(0.5))
                    .opacity(textOpacity)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                iconScale = 1.0
                iconOpacity = 1.0
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.2)) {
                textOpacity = 1.0
            }
        }
    }
}

#Preview {
    SplashView()
}
