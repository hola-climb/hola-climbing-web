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
    // 스트림 id → 미완성 바이트 버퍼. UTF-8 멀티바이트(한글)가 청크 경계에서
    // 잘려도 데이터가 유실되지 않도록 String 이 아닌 Data 로 누적한다.
    private var bufferById: [String: Data] = [:]
    private let lock = NSLock()
    // SSE 프레임 구분자 `\n\n`
    private let frameDelimiter = Data([0x0A, 0x0A])

    public override func load() {
        let config = URLSessionConfiguration.default
        // SSE 는 장시간 열려 있으므로 요청 타임아웃을 크게 둔다(자원 타임아웃은 무한).
        config.timeoutIntervalForRequest = 600
        config.timeoutIntervalForResource = TimeInterval.infinity
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    /** notifyListeners 는 반드시 메인 스레드에서 호출(델리게이트 콜백은 백그라운드 큐). */
    private func emit(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners(event, data: data)
        }
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
        bufferById[id] = Data()
        lock.unlock()

        CAPLog.print("[HolaSse] connect id=\(id) url=\(urlString) token=\(token?.isEmpty == false)")
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
        CAPLog.print("[HolaSse] disconnect id=\(id)")
        task?.cancel()
        call.resolve()
    }

    // MARK: - URLSessionDataDelegate

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        lock.lock()
        let id = idByTask[dataTask.taskIdentifier]
        lock.unlock()
        CAPLog.print("[HolaSse] response id=\(id ?? "?") status=\(status)")

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if let id = id {
                emit("sseError", ["id": id, "message": "SSE error: \(http.statusCode)"])
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
        var buffer = (bufferById[id] ?? Data())
        buffer.append(data)

        // 완성된 프레임(`\n\n`)만 바이트 단위로 잘라 전달하고 미완성분은 버퍼에 남긴다.
        var frames: [String] = []
        while let range = buffer.range(of: frameDelimiter) {
            let frameData = buffer.subdata(in: buffer.startIndex..<range.lowerBound)
            if let frame = String(data: frameData, encoding: .utf8), !frame.isEmpty {
                frames.append(frame)
            }
            buffer = buffer.subdata(in: range.upperBound..<buffer.endIndex)
        }
        bufferById[id] = buffer
        lock.unlock()

        CAPLog.print("[HolaSse] data id=\(id) bytes=\(data.count) frames=\(frames.count)")
        for frame in frames {
            emit("sseMessage", ["id": id, "data": frame])
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
            if error.code == NSURLErrorCancelled { // 명시적 disconnect — 무시
                CAPLog.print("[HolaSse] cancelled id=\(id)")
                return
            }
            CAPLog.print("[HolaSse] error id=\(id) \(error.localizedDescription)")
            emit("sseError", ["id": id, "message": error.localizedDescription])
        } else {
            CAPLog.print("[HolaSse] close id=\(id)")
            emit("sseClose", ["id": id])
        }
    }
}
