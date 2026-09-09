import SwiftUI

enum VibeConfiguration {
    static let siteURL = URL(string: "https://vibe-social-nights.bb0949.chatgpt.site")!
}

@main
struct VibeApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
