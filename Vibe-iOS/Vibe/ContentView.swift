import SwiftUI

struct ContentView: View {
    @State private var loading = true
    @State private var failure: String?
    @State private var reloadID = UUID()

    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.03, blue: 0.07).ignoresSafeArea()
            VibeWebView(url: VibeConfiguration.siteURL, loading: $loading, failure: $failure)
                .id(reloadID)
            if loading && failure == nil {
                ProgressView().tint(.purple).padding(18)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            }
            if failure != nil {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                    Text("تعذّر تحميل فايب / Could not load Vibe")
                        .font(.headline).multilineTextAlignment(.center)
                    Text("تحقّق من الإنترنت ثم حاول مجدداً.\nCheck your connection and try again.")
                        .multilineTextAlignment(.center)
                    Button("إعادة المحاولة / Retry") {
                        failure = nil
                        loading = true
                        reloadID = UUID()
                    }.buttonStyle(.borderedProminent)
                }
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                .padding()
            }
        }
        .preferredColorScheme(.dark)
    }
}
