import Foundation
import Capacitor

/**
 * iOS 네이티브 SSE(Server-Sent Events) 플러그인.
 *
 * WKWebView 의 fetch 는 응답 body 를 점진적으로 전달하지 않고 버퍼링하므로
 * SSE 스트림이 동작하지 않는다. 이 플러그인은 URLSession 으로 네이티브에서
 * 스트리밍을 수행하고, 완성된 SSE 프레임(`\n\n` 단위)을 JS 로 전달한다.
 * 이벤트/데이터 파싱은 JS 측에서 수행해 웹과 동일한 로직을 재사용한다.
 *
 * JS 이벤트:
 *   sseMessage { id, data }   — 완성된 SSE 프레임 1개
 *   sseClose   { id }         — 스트림 정상 종료
 *   sseError   { id, message }— 스트림 오류(취소 제외)
 */
@objc(HolaSsePlugin)
public class HolaSsePlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDataDelegate {
    public let identifier = "HolaSsePlugin"
    public let jsName = "HolaSse"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var session: URLSession!
    // taskIdentifier → 우리가 발급한 스트림 id
    private var idByTask: [Int: String] = [:]
    // 스트림 id → 활성 task
    private var taskById: [String: URLSessionDataTask] = [:]
    // 스트림 id → 미완성 프레임 누적 버퍼
    private var bufferById: [String: String] = [:]
    private let lock = NSLock()

    public override func load() {
        let config = URLSessionConfiguration.default
        // SSE 는 장시간 열려 있으므로 요청 타임아웃을 크게 둔다(자원 타임아웃은 무한).
        config.timeoutIntervalForRequest = 600
        config.timeoutIntervalForResource = TimeInterval.infinity
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("invalid url")
            return
        }
        let token = call.getString("token")
        let id = UUID().uuidString

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        if let token = token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let task = session.dataTask(with: request)

        lock.lock()
        idByTask[task.taskIdentifier] = id
        taskById[id] = task
        bufferById[id] = ""
        lock.unlock()

        task.resume()
        call.resolve(["id": id])
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("missing id")
            return
        }
        lock.lock()
        let task = taskById[id]
        taskById[id] = nil
        bufferById[id] = nil
        if let t = task { idByTask[t.taskIdentifier] = nil }
        lock.unlock()
        task?.cancel()
        call.resolve()
    }

    // MARK: - URLSessionDataDelegate

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            lock.lock()
            let id = idByTask[dataTask.taskIdentifier]
            lock.unlock()
            if let id = id {
                notifyListeners("sseError", data: ["id": id, "message": "SSE error: \(http.statusCode)"])
            }
            completionHandler(.cancel)
            return
        }
        completionHandler(.allow)
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock()
        guard let id = idByTask[dataTask.taskIdentifier] else {
            lock.unlock()
            return
        }
        var buffer = (bufferById[id] ?? "") + (String(data: data, encoding: .utf8) ?? "")

        // 완성된 프레임(`\n\n`)만 잘라 전달하고 미완성분은 버퍼에 남긴다.
        var frames: [String] = []
        while let range = buffer.range(of: "\n\n") {
            let frame = String(buffer[buffer.startIndex..<range.lowerBound])
            frames.append(frame)
            buffer = String(buffer[range.upperBound...])
        }
        bufferById[id] = buffer
        lock.unlock()

        for frame in frames where !frame.isEmpty {
            notifyListeners("sseMessage", data: ["id": id, "data": frame])
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let id = idByTask[task.taskIdentifier]
        idByTask[task.taskIdentifier] = nil
        if let id = id {
            taskById[id] = nil
            bufferById[id] = nil
        }
        lock.unlock()

        guard let id = id else { return }

        if let error = error as NSError? {
            if error.code == NSURLErrorCancelled { return } // 명시적 disconnect — 무시
            notifyListeners("sseError", data: ["id": id, "message": error.localizedDescription])
        } else {
            notifyListeners("sseClose", data: ["id": id])
        }
    }
}
