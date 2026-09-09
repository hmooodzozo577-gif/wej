import SwiftUI
import WebKit
import UIKit

struct VibeWebView: UIViewRepresentable {
    let url: URL
    @Binding var loading: Bool
    @Binding var failure: String?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        // User interaction is still used for recording and starting cinema playback.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // Preserve browser language and consent preferences between launches.
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.04, green: 0.03, blue: 0.07, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        // No reload here: SwiftUI updates must not interrupt a recording.
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.loadHTMLString("", baseURL: nil)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: VibeWebView
        init(_ parent: VibeWebView) { self.parent = parent }

        private func isVibe(_ url: URL?) -> Bool {
            guard let url else { return false }
            return url.scheme == "https" && url.host == parent.url.host
                && url.user == nil && url.password == nil
                && (url.port == nil || url.port == 443)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Embedded media is constrained by the site's Content Security Policy.
            if navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(.allow)
                return
            }
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if isVibe(url) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                if url.scheme == "https", navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(url)
                }
            }
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard navigationAction.targetFrame == nil,
                  let url = navigationAction.request.url, url.scheme == "https" else { return nil }
            if isVibe(url) { webView.load(URLRequest(url: url)) }
            else { UIApplication.shared.open(url) }
            return nil
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            let trusted = origin.protocol == "https" && origin.host == parent.url.host
                && (origin.port == 0 || origin.port == 443) && frame.isMainFrame
                && isVibe(frame.request.url)
            decisionHandler(trusted ? .prompt : .deny)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.loading = true
            parent.failure = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.loading = false
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) { showFailure(error) }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!,
                     withError error: Error) { showFailure(error) }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            parent.loading = false
            parent.failure = "Web content process ended."
        }

        private func showFailure(_ error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            parent.loading = false
            parent.failure = error.localizedDescription
        }
    }
}
